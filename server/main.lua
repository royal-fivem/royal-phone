---Active calls, keyed by source. Purely in-memory — a call never outlives a
---session so there is nothing worth persisting here.
---@type table<number, { with: number, number: string, since: number }>
local activeCalls = {}

--#region helpers

local function getPlayer(src)
    if type(Bridge) ~= 'table' or type(Bridge.GetPlayer) ~= 'function' then return nil end
    local ok, player = pcall(Bridge.GetPlayer, src)
    if not ok then return nil end
    return player
end

---Whose phone this is. With SIM cards on, that is the card in their pocket
---rather than the character — see server/identity.lua.
local function identityOf(src)
    return Identity.get(src)
end

local function getNumber(src)
    return Identity.number(src)
end

---Write one line into the phone's own ledger. Deliberately separate from the
---framework's money log: the Bank app shows what the phone knows about, and any
---resource can add to it with the AddTransaction export.
---@param identifier string
---@param label string
---@param amount number negative for money out
local function logTransaction(identifier, label, amount)
    if not identifier then return end

    MySQL.insert('INSERT INTO royal_phone_bank_transactions (identifier, label, amount) VALUES (?, ?, ?)', {
        identifier, tostring(label):sub(1, 64), math.floor(amount),
    })
end

---Credit anything that arrived while the character was offline.
---@param src number
---@param identifier string
local function claimPending(src, identifier)
    local rows = MySQL.query.await(
        'SELECT id, amount FROM royal_phone_bank_pending WHERE identifier = ?', { identifier }
    ) or {}

    if #rows == 0 then return end
    if type(Bridge.MoveMoney) ~= 'function' then return end

    for _, row in ipairs(rows) do
        if Bridge.MoveMoney(src, 'bank', row.amount, 'royal-phone transfer') then
            MySQL.update('DELETE FROM royal_phone_bank_pending WHERE id = ?', { row.id })
        end
    end
end

---Who is holding the phone that owns this number right now, if anyone.
local function sourceFromNumber(number)
    return Identity.sourceFromNumber(number)
end

--#endregion

--#region data

lib.callback.register('royal-phone:server:getData', function(src)
    local player = getPlayer(src)
    if not player then return nil end

    -- Everything below is keyed on the phone's owner, which with SIM cards is the
    -- card rather than the character. Swap the card, get someone else's phone.
    local identity = identityOf(src)

    if not identity then
        -- Only on the failure path, so one extra inventory read is fine: tell them
        -- which of the two things is actually missing.
        local hasPhone = Config.Inventory == 'ox_inventory'
            and (exports.ox_inventory:GetSlotWithItem(src, Config.ItemName) ~= nil)

        return { noSim = true, reason = hasPhone and 'no_sim' or 'no_phone' }
    end

    local owner = identity.owner
    local number = identity.number

    local contacts = MySQL.query.await(
        'SELECT id, name, number, avatar FROM royal_phone_contacts WHERE identifier = ? ORDER BY name ASC',
        { owner }
    ) or {}

    local messages

    local calls = MySQL.query.await([[
        SELECT id, caller, receiver, answered, UNIX_TIMESTAMP(created_at) * 1000 AS createdAt
        FROM royal_phone_calls
        WHERE caller = ? OR receiver = ?
        ORDER BY created_at DESC
        LIMIT 50
    ]], { number, number }) or {}

    local notes = MySQL.scalar.await(
        'SELECT notes FROM royal_phone_notes WHERE identifier = ? LIMIT 1', { owner }
    )

    -- Banking follows the character, not the SIM — money is theirs, not the
    -- card's, and a stolen SIM must not hand over someone's bank account.
    claimPending(src, player.identifier)

    local transactions = MySQL.query.await([[
        SELECT id, label, amount, UNIX_TIMESTAMP(created_at) * 1000 AS createdAt
        FROM royal_phone_bank_transactions
        WHERE identifier = ?
        ORDER BY created_at DESC
        LIMIT 50
    ]], { player.identifier }) or {}

    -- Groups you are *in*, not just ones you own. Membership is its own table so
    -- every member's phone can see the group; the owner's row used to be the only
    -- place the list existed, which meant nobody else knew the group was there.
    local groupRows = MySQL.query.await([[
        SELECT g.id, g.name, g.avatar, g.identifier AS owner,
               UNIX_TIMESTAMP(m.last_read) * 1000 AS lastRead
        FROM royal_phone_group_members m
        JOIN royal_phone_groups g ON g.id = m.group_id
        WHERE m.identifier = ?
    ]], { owner }) or {}

    local groups = {}
    local groupKeys = {}

    if #groupRows > 0 then
        local ids = {}
        for _, row in ipairs(groupRows) do ids[#ids + 1] = row.id end

        -- One pass for every member of every group the player is in.
        local placeholders = string.rep('?,', #ids):sub(1, -2)
        local memberRows = MySQL.query.await(
            ('SELECT group_id, number FROM royal_phone_group_members WHERE group_id IN (%s)'):format(placeholders),
            ids
        ) or {}

        local byGroup = {}
        for _, row in ipairs(memberRows) do
            byGroup[row.group_id] = byGroup[row.group_id] or {}
            byGroup[row.group_id][#byGroup[row.group_id] + 1] = row.number
        end

        for _, row in ipairs(groupRows) do
            groupKeys[#groupKeys + 1] = ('group:%d'):format(row.id)

            groups[#groups + 1] = {
                id = row.id,
                name = row.name,
                avatar = row.avatar,
                members = byGroup[row.id] or {},
                owner = row.owner == owner and number or nil,
                isOwner = row.owner == owner,
                lastRead = row.lastRead,
            }
        end
    end

    -- Direct traffic plus every group the player belongs to. Group messages are
    -- filed under the group key, so without this second clause a member who was
    -- offline when it was sent would never see it — which is what made groups
    -- look like they only worked for whoever happened to be online.
    if #groupKeys > 0 then
        local placeholders = string.rep('?,', #groupKeys):sub(1, -2)
        local params = { number, number }
        for _, key in ipairs(groupKeys) do params[#params + 1] = key end

        messages = MySQL.query.await(([[
            SELECT id, sender, receiver, content, kind, media, seconds, location, `read`,
                   UNIX_TIMESTAMP(created_at) * 1000 AS createdAt
            FROM royal_phone_messages
            WHERE sender = ? OR receiver = ? OR receiver IN (%s)
            ORDER BY created_at ASC
            LIMIT 800
        ]]):format(placeholders), params) or {}
    else
        messages = MySQL.query.await([[
            SELECT id, sender, receiver, content, kind, media, seconds, location, `read`,
                   UNIX_TIMESTAMP(created_at) * 1000 AS createdAt
            FROM royal_phone_messages
            WHERE sender = ? OR receiver = ?
            ORDER BY created_at ASC
            LIMIT 500
        ]], { number, number }) or {}
    end

    -- Location rides in the database as JSON; the UI wants it as a table.
    for _, message in ipairs(messages) do
        if message.location then
            local ok, parsed = pcall(json.decode, message.location)
            message.location = ok and parsed or nil
        end
    end

    -- A group message has no per-recipient read flag — one row serves everyone —
    -- so "unread" is anything newer than this member's last visit to the thread.
    for _, message in ipairs(messages) do
        if message.receiver and message.receiver:find('^group:') then
            local id = tonumber(message.receiver:match('^group:(%d+)$'))

            for _, group in ipairs(groups) do
                if group.id == id then
                    message.read = (message.sender == number or message.createdAt <= (group.lastRead or 0)) and 1 or 0
                    break
                end
            end
        end
    end

    return {
        number = number,
        name = identity.name,
        -- Whose card this is, shown in Settings. Different from `name` when the
        -- player is using somebody else's SIM.
        sim = identity.serial,
        simOwner = identity.registeredTo,
        job = player.job,
        gang = player.gang,
        cash = player.cash,
        bank = player.bank,
        -- Bank app activity feed. Phone transfers write themselves in; other
        -- resources add lines with the AddTransaction export.
        transactions = transactions,
        contacts = contacts,
        groups = groups,
        messages = messages,
        calls = calls,
        notes = notes and json.decode(notes) or {},
    }
end)

--#endregion

--#region messages

lib.callback.register('royal-phone:server:sendMessage', function(src, number, content, extra)
    if type(number) ~= 'string' or type(content) ~= 'string' then return false end

    content = content:sub(1, 500)
    if content == '' then return false end

    local identity = identityOf(src)
    if not identity then return false end

    local sender = identity.number
    -- The name that goes out is whoever is holding the phone, not whoever the SIM
    -- is registered to: if you text from a stolen card, the text is from you.
    local senderName = identity.name ~= '' and identity.name or sender

    extra = extra or {}

    -- What is attached to the message, stored alongside it. These used to be
    -- passed to the recipient and then thrown away, so a photo, a voice note or a
    -- shared location survived only until someone reopened their phone.
    local kind = tostring(extra.kind or 'text'):sub(1, 12)
    local seconds = tonumber(extra.seconds)
    local media = extra.media and tostring(extra.media) or nil
    local location = extra.location and json.encode(extra.location):sub(1, 255) or nil

    if media and #media > Config.MediaMaxLength then
        -- Bigger than we are willing to keep. The message still goes, without it.
        media = nil
        if kind == 'voice' then kind = 'text' end
    end

    local function payloadFor(id)
        return {
            id = id,
            sender = sender,
            receiver = number,
            content = content,
            kind = kind,
            media = media,
            seconds = seconds,
            location = extra.location,
            name = senderName,
            createdAt = os.time() * 1000,
        }
    end

    local INSERT = [[
        INSERT INTO royal_phone_messages (sender, receiver, content, kind, media, seconds, location)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]]

    -- Group message: one row under the group key, then a nudge to whoever is
    -- online. Membership comes from the database rather than the payload — a
    -- client-supplied member list is a way to text people who are not in the
    -- group. Offline members pick it up from that same row on next open.
    local groupId = tonumber(tostring(number):match('^group:(%d+)$'))

    if groupId then
        local isMember = MySQL.scalar.await(
            'SELECT 1 FROM royal_phone_group_members WHERE group_id = ? AND identifier = ? LIMIT 1',
            { groupId, identity.owner }
        )
        if not isMember then return false end

        local id = MySQL.insert.await(INSERT, { sender, number, content, kind, media, seconds, location })

        local rows = MySQL.query.await(
            'SELECT number FROM royal_phone_group_members WHERE group_id = ? AND number <> ?',
            { groupId, sender }
        ) or {}

        for _, row in ipairs(rows) do
            local memberSrc = sourceFromNumber(row.number)
            if memberSrc and memberSrc ~= src then
                TriggerClientEvent('royal-phone:client:newMessage', memberSrc, payloadFor(id))
            end
        end

        return { id = id, createdAt = os.time() * 1000 }
    end

    local id = MySQL.insert.await(INSERT, { sender, number, content, kind, media, seconds, location })

    local target = sourceFromNumber(number)
    if target then
        TriggerClientEvent('royal-phone:client:newMessage', target, payloadFor(id))
    end

    return { id = id, createdAt = os.time() * 1000 }
end)

RegisterNetEvent('royal-phone:server:markRead', function(number)
    local identity = identityOf(source)
    if not identity or type(number) ~= 'string' then return end

    -- Groups have one row for everyone, so "read" is a per-member watermark
    -- rather than a flag on the message.
    local groupId = tonumber(number:match('^group:(%d+)$'))

    if groupId then
        MySQL.update('UPDATE royal_phone_group_members SET last_read = CURRENT_TIMESTAMP WHERE group_id = ? AND identifier = ?', {
            groupId, identity.owner,
        })
        return
    end

    MySQL.update('UPDATE royal_phone_messages SET `read` = 1 WHERE receiver = ? AND sender = ?', {
        identity.number, number,
    })
end)

--#endregion

--#region groups

---Everyone in a group, as owner keys — used to push refreshes.
local function groupOwners(id)
    local rows = MySQL.query.await(
        'SELECT identifier FROM royal_phone_group_members WHERE group_id = ?', { id }
    ) or {}

    local out = {}
    for _, row in ipairs(rows) do out[#out + 1] = row.identifier end
    return out
end

---Tell every member's open phone the group changed.
local function refreshGroup(id)
    for _, owner in ipairs(groupOwners(id)) do
        Identity.refreshOwner(owner, 'data')
    end
end

---Add a number to a group, no questions asked. Used once the invitee has said
---yes, and for anyone who is offline — see inviteNumber below.
---@return boolean
local function addMember(id, number)
    local identifier = MySQL.scalar.await(
        'SELECT identifier FROM royal_phone_numbers WHERE number = ? LIMIT 1', { number }
    )
    if not identifier then return false end

    MySQL.insert.await([[
        INSERT IGNORE INTO royal_phone_group_members (group_id, identifier, number)
        VALUES (?, ?, ?)
    ]], { id, identifier, number })

    return true
end

---Invite a number into a group.
---
---Online, it asks: being dropped into a group chat without a say is the same
---problem as having a contact pushed at you. Offline, it just adds them — there
---is nobody to ask, and a group you were told about but never joined is worse
---than one that is simply waiting for you.
---@param groupId number
---@param number string
---@param from number source of the inviter
---@param groupName string
---@param inviterName string
---@return boolean true when the number resolved to somebody
local function inviteNumber(groupId, number, from, groupName, inviterName)
    local identifier = MySQL.scalar.await(
        'SELECT identifier FROM royal_phone_numbers WHERE number = ? LIMIT 1', { number }
    )
    if not identifier then return false end

    local already = MySQL.scalar.await(
        'SELECT 1 FROM royal_phone_group_members WHERE group_id = ? AND identifier = ? LIMIT 1',
        { groupId, identifier }
    )
    if already then return true end

    local target = Identity.sourcesForOwner(identifier)[1]

    if not target then
        return addMember(groupId, number)
    end

    PhoneOffer({
        kind = 'group',
        to = target,
        from = from,
        group = groupId,
        number = number,
        name = groupName,
    }, {
        app = 'messages',
        title = 'Group invite',
        content = ('%s added you to "%s"'):format(inviterName, groupName),
        route = { number = ('group:%d'):format(groupId) },
        offer = { acceptLabel = 'Join', acceptedText = ('Joined "%s"'):format(groupName) },
    })

    return true
end

lib.callback.register('royal-phone:server:createGroup', function(src, name, members)
    local identity = identityOf(src)
    if not identity or type(members) ~= 'table' then return false end

    name = type(name) == 'string' and name:sub(1, 48):gsub('^%s+', ''):gsub('%s+$', '') or ''
    if name == '' then return { error = 'Give the group a name.' } end
    if #members == 0 then return { error = 'Pick at least one person.' } end

    local id = MySQL.insert.await(
        'INSERT INTO royal_phone_groups (identifier, name, members) VALUES (?, ?, ?)',
        { identity.owner, name, json.encode(members) }
    )

    -- The creator is a member of their own group.
    MySQL.insert.await([[
        INSERT IGNORE INTO royal_phone_group_members (group_id, identifier, number)
        VALUES (?, ?, ?)
    ]], { id, identity.owner, identity.number })

    local added = 0
    for _, number in ipairs(members) do
        if inviteNumber(id, tostring(number), src, name, identity.name) then added += 1 end
    end

    if added == 0 then
        MySQL.update.await('DELETE FROM royal_phone_groups WHERE id = ?', { id })
        MySQL.update.await('DELETE FROM royal_phone_group_members WHERE group_id = ?', { id })
        return { error = 'None of those numbers exist.' }
    end

    refreshGroup(id)

    return { id = id }
end)

---Owner-only edits: name and picture.
RegisterNetEvent('royal-phone:server:updateGroup', function(id, name, avatar)
    local identity = identityOf(source)
    if not identity or not id then return end

    local owns = MySQL.scalar.await(
        'SELECT 1 FROM royal_phone_groups WHERE id = ? AND identifier = ? LIMIT 1', { id, identity.owner }
    )
    if not owns then return end

    if type(name) == 'string' and name:gsub('%s', '') ~= '' then
        MySQL.update.await('UPDATE royal_phone_groups SET name = ? WHERE id = ?', { name:sub(1, 48), id })
    end

    if avatar ~= nil then
        MySQL.update.await('UPDATE royal_phone_groups SET avatar = ? WHERE id = ?', {
            avatar ~= '' and tostring(avatar):sub(1, 400) or nil, id,
        })
    end

    refreshGroup(id)
end)

lib.callback.register('royal-phone:server:inviteToGroup', function(src, data)
    local identity = identityOf(src)
    if not identity or type(data) ~= 'table' then return false end

    local id = tonumber(data.id)
    local number = tostring(data.number or ''):gsub('%s', '')
    if not id then return false end
    if number == '' then return { error = 'Enter a number.' } end

    local group = MySQL.single.await(
        'SELECT name FROM royal_phone_groups WHERE id = ? AND identifier = ? LIMIT 1', { id, identity.owner }
    )
    if not group then return { error = 'Only the owner can invite.' } end

    if not inviteNumber(id, number, src, group.name, identity.name) then
        return { error = 'Nobody on that number.' }
    end

    refreshGroup(id)
    return { ok = true, invited = true }
end)

RegisterNetEvent('royal-phone:server:kickFromGroup', function(id, number)
    local identity = identityOf(source)
    if not identity or not id then return end

    local owner = MySQL.scalar.await('SELECT identifier FROM royal_phone_groups WHERE id = ? LIMIT 1', { id })
    if owner ~= identity.owner then return end
    -- The owner cannot kick themselves; deleting is the way out for them.
    if number == identity.number then return end

    local members = groupOwners(id)

    MySQL.update.await('DELETE FROM royal_phone_group_members WHERE group_id = ? AND number = ?', { id, number })

    for _, key in ipairs(members) do Identity.refreshOwner(key, 'data') end
end)

---Delete if you own it, leave if you do not. One button, two meanings — which is
---exactly how it reads in the UI.
RegisterNetEvent('royal-phone:server:removeGroup', function(id)
    local identity = identityOf(source)
    if not identity or not id then return end

    local owner = MySQL.scalar.await('SELECT identifier FROM royal_phone_groups WHERE id = ? LIMIT 1', { id })
    if not owner then return end

    local members = groupOwners(id)

    if owner == identity.owner then
        MySQL.update.await('DELETE FROM royal_phone_groups WHERE id = ?', { id })
        MySQL.update.await('DELETE FROM royal_phone_group_members WHERE group_id = ?', { id })
    else
        MySQL.update.await(
            'DELETE FROM royal_phone_group_members WHERE group_id = ? AND identifier = ?',
            { id, identity.owner }
        )
    end

    for _, key in ipairs(members) do Identity.refreshOwner(key, 'data') end
end)

--#endregion

--#region contacts

lib.callback.register('royal-phone:server:addContact', function(src, data)
    local identity = identityOf(src)
    if not identity or type(data) ~= 'table' then return false end

    local name = tostring(data.name or ''):sub(1, 48)
    local number = tostring(data.number or ''):sub(1, 24)
    if name == '' or number == '' then return false end

    if data.id then
        MySQL.update.await(
            'UPDATE royal_phone_contacts SET name = ?, number = ?, avatar = ? WHERE id = ? AND identifier = ?',
            { name, number, data.avatar, data.id, identity.owner }
        )
        return { id = data.id }
    end

    local id = MySQL.insert.await(
        'INSERT INTO royal_phone_contacts (identifier, name, number, avatar) VALUES (?, ?, ?, ?)',
        { identity.owner, name, number, data.avatar }
    )

    return { id = id }
end)

lib.callback.register('royal-phone:server:removeContact', function(src, id)
    local identity = identityOf(src)
    if not identity or not id then return false end

    MySQL.update.await(
        'DELETE FROM royal_phone_contacts WHERE id = ? AND identifier = ?',
        { id, identity.owner }
    )

    return true
end)

--#endregion

--#region notes

RegisterNetEvent('royal-phone:server:saveNotes', function(notes)
    local identity = identityOf(source)
    if not identity or type(notes) ~= 'table' then return end

    MySQL.insert([[
        INSERT INTO royal_phone_notes (identifier, notes) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE notes = VALUES(notes)
    ]], { identity.owner, json.encode(notes) })
end)

--#endregion

--#region calls

---Voice channel ids. Any positive number works as long as no two live calls
---share one, so a counter is enough — it never has to survive a restart because
---no call does either.
local nextChannel = 0

local function claimChannel()
    nextChannel += 1
    if nextChannel > 1000000 then nextChannel = 1 end
    return nextChannel
end

---Tear a call down on both ends, once. Returns the pair that was dropped.
---@param src number
---@param reason 'hangup'|'declined'|'unavailable'|'dropped'
local function dropCall(src, reason)
    local call = activeCalls[src]
    if not call then return end

    local other = call.with
    activeCalls[src] = nil
    if other then activeCalls[other] = nil end

    -- Both sides leave the voice channel even if only one of them hung up.
    TriggerClientEvent('royal-phone:client:callEnded', src, { reason = reason })
    if other then
        TriggerClientEvent('royal-phone:client:callEnded', other, { reason = reason })
    end

    if call.logId and call.answeredAt then
        MySQL.update('UPDATE royal_phone_calls SET answered = 1 WHERE id = ?', { call.logId })
    end
end

RegisterNetEvent('royal-phone:server:call', function(number)
    local src = source
    if type(number) ~= 'string' then return end

    local caller = getNumber(src)
    if not caller or caller == number then return end

    -- Already on a call: ignore rather than silently replacing it.
    if activeCalls[src] then return end

    local target = sourceFromNumber(number)

    local logId = MySQL.insert.await(
        'INSERT INTO royal_phone_calls (caller, receiver, answered) VALUES (?, ?, 0)',
        { caller, number }
    )

    -- Nobody home, or they are already talking to someone else.
    if not target or activeCalls[target] then
        TriggerClientEvent('royal-phone:client:callEnded', src, { reason = 'unavailable' })
        return
    end

    local callerPlayer = getPlayer(src)
    local callerName = callerPlayer
        and ('%s %s'):format(callerPlayer.firstname or '', callerPlayer.lastname or '')
        or caller

    local channel = claimChannel()

    activeCalls[src] = {
        with = target, number = number, since = os.time(),
        channel = channel, logId = logId, outgoing = true,
    }
    activeCalls[target] = {
        with = src, number = caller, since = os.time(),
        channel = channel, logId = logId, outgoing = false,
    }

    TriggerClientEvent('royal-phone:client:incomingCall', target, {
        number = caller,
        name = callerName,
    })
end)

---The receiver picked up. Until this lands the caller is only ringing — this is
---what puts both of them on the voice channel.
RegisterNetEvent('royal-phone:server:answerCall', function()
    local src = source
    local call = activeCalls[src]
    if not call or call.answeredAt then return end

    local other = call.with
    if not other or not activeCalls[other] then
        dropCall(src, 'unavailable')
        return
    end

    local now = os.time()
    call.answeredAt = now
    activeCalls[other].answeredAt = now

    MySQL.update('UPDATE royal_phone_calls SET answered = 1 WHERE id = ?', { call.logId })

    -- Same channel number on both ends is what actually connects them.
    TriggerClientEvent('royal-phone:client:callConnected', src, { channel = call.channel })
    TriggerClientEvent('royal-phone:client:callConnected', other, { channel = call.channel })
end)

RegisterNetEvent('royal-phone:server:declineCall', function()
    dropCall(source, 'declined')
end)

RegisterNetEvent('royal-phone:server:endCall', function()
    dropCall(source, 'hangup')
end)

AddEventHandler('playerDropped', function()
    dropCall(source, 'dropped')
end)

--#endregion

--#region nearby players

---Everyone standing near the caller, for sharing a contact or a document.
---Distance is measured server-side from ped coords so a client cannot claim to
---be next to someone across the map.
lib.callback.register('royal-phone:server:getNearby', function(src)
    local origin = GetEntityCoords(GetPlayerPed(src))
    local range = Config.NearbyRange or 12.0
    local found = {}

    for _, id in ipairs(GetPlayers()) do
        local other = tonumber(id)

        if other and other ~= src then
            local coords = GetEntityCoords(GetPlayerPed(other))

            if #(origin - coords) <= range then
                local player = getPlayer(other)

                if player then
                    found[#found + 1] = {
                        source = other,
                        name = ('%s %s'):format(player.firstname or '', player.lastname or ''),
                        number = getNumber(other),
                    }
                end
            end
        end
    end

    return found
end)

---Offers waiting on an answer.
---
---Keyed by a token the recipient hands back, so several can be outstanding at
---once without them getting confused — a document invite and a contact share can
---sit in the tray together. The payload is held here rather than sent to the
---client and returned, because a client that can edit the offer can accept a
---contact nobody offered it.
---
---@type table<string, { kind: string, to: number, from: number, at: number, [string]: any }>
local offers = {}
local offerCounter = 0

local OFFER_TTL = 120

local function newOffer(data)
    offerCounter += 1

    local token = ('%d-%d'):format(os.time(), offerCounter)
    data.at = os.time()
    offers[token] = data

    return token
end

---Take an offer off the pile, if it is still valid and belongs to this player.
local function claimOffer(src, token)
    local offer = offers[token]
    if not offer then return nil end

    offers[token] = nil

    if offer.to ~= src then return nil end
    if os.time() - offer.at > OFFER_TTL then return nil end

    return offer
end

-- Nothing here outlives a session, and a stale table would leak. Swept lazily
-- rather than on a timer: the list is tiny and only grows when someone shares.
local function sweepOffers()
    local now = os.time()
    for token, offer in pairs(offers) do
        if now - offer.at > OFFER_TTL then offers[token] = nil end
    end
end

---Offer one of your contacts to a nearby player.
---
---This only *asks*. Nothing is written until they accept — pushing a contact
---straight into someone's phone is not something the other player agreed to, and
---it made "share" a way to spam anyone standing near you.
---
---The number comes from the sender's own contact list rather than the payload,
---and the recipient must actually be in range.
lib.callback.register('royal-phone:server:shareContact', function(src, data)
    local identity = identityOf(src)
    if not identity or type(data) ~= 'table' then return false end

    local target = tonumber(data.target)
    if not target or target == src then return false end

    local origin = GetEntityCoords(GetPlayerPed(src))
    local coords = GetEntityCoords(GetPlayerPed(target))
    if #(origin - coords) > (Config.NearbyRange or 12.0) then return { error = 'too_far' } end

    local targetIdentity = identityOf(target)
    if not targetIdentity then return { error = 'no_phone' } end

    sweepOffers()

    local name, number

    if data.id then
        local row = MySQL.single.await(
            'SELECT name, number FROM royal_phone_contacts WHERE id = ? AND identifier = ?',
            { data.id, identity.owner }
        )
        if not row then return false end

        name, number = row.name, row.number
    else
        -- Sharing your own card.
        name, number = identity.name, identity.number
    end

    if not number then return false end

    local existing = MySQL.scalar.await(
        'SELECT 1 FROM royal_phone_contacts WHERE identifier = ? AND number = ? LIMIT 1',
        { targetIdentity.owner, number }
    )
    if existing then return { already = true, name = name } end

    local token = newOffer({
        kind = 'contact',
        to = target,
        from = src,
        name = name,
        number = number,
        sender = identity.name,
    })

    -- The ask arrives as a phone notification with Accept / Decline on it, so it
    -- lands the same whether their phone is open, pocketed or peeking.
    TriggerClientEvent('royal-phone:client:notify', target, {
        app = 'dialer',
        title = 'Contact offered',
        content = ('%s wants to share %s (%s)'):format(identity.name, name, number),
        sound = true,
        duration = 0,
        offer = {
            kind = 'contact',
            token = token,
            acceptLabel = 'Save',
            acceptedText = ('Saved %s'):format(name),
        },
    })

    return { offered = true, name = name }
end)

---The recipient answered an offer.
---
---Everything is read from the offer the server recorded; the client hands back
---only a token. A payload-driven version would let a client accept a contact
---nobody offered it.
RegisterNetEvent('royal-phone:server:answerOffer', function(data)
    local src = source
    if type(data) ~= 'table' then return end

    local offer = claimOffer(src, tostring(data.token or ''))
    if not offer then return end

    local accepted = data.accepted == true

    if not accepted then
        if offer.from then
            TriggerClientEvent('royal-phone:client:notify', offer.from, {
                app = offer.kind == 'document' and 'documents' or 'dialer',
                title = 'Declined',
                content = ('They turned down %s.'):format(offer.name or 'your offer'),
            })
        end
        return
    end

    local identity = identityOf(src)
    if not identity then return end

    if offer.kind == 'contact' then
        local existing = MySQL.scalar.await(
            'SELECT 1 FROM royal_phone_contacts WHERE identifier = ? AND number = ? LIMIT 1',
            { identity.owner, offer.number }
        )

        if not existing then
            MySQL.insert.await(
                'INSERT INTO royal_phone_contacts (identifier, name, number) VALUES (?, ?, ?)',
                { identity.owner, offer.name, offer.number }
            )
        end

        Identity.refresh(src, 'data')

        if offer.from then
            TriggerClientEvent('royal-phone:client:notify', offer.from, {
                app = 'dialer',
                title = 'Contact shared',
                content = ('They saved %s.'):format(offer.name),
            })
        end

        return
    end

    if offer.kind == 'group' then
        MySQL.insert.await([[
            INSERT IGNORE INTO royal_phone_group_members (group_id, identifier, number)
            VALUES (?, ?, ?)
        ]], { offer.group, identity.owner, identity.number })

        -- Everyone in the group sees the new member, including the joiner.
        local rows = MySQL.query.await(
            'SELECT identifier FROM royal_phone_group_members WHERE group_id = ?', { offer.group }
        ) or {}

        for _, row in ipairs(rows) do Identity.refreshOwner(row.identifier, 'data') end

        if offer.from then
            TriggerClientEvent('royal-phone:client:notify', offer.from, {
                app = 'messages',
                title = 'Joined',
                content = ('They joined "%s".'):format(offer.name or 'the group'),
            })
        end

        return
    end

    if offer.kind == 'document' then
        MySQL.insert.await([[
            INSERT INTO royal_phone_document_shares (document, identifier, number, name, can_edit)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE number = VALUES(number), name = VALUES(name), can_edit = VALUES(can_edit)
        ]], { offer.document, identity.owner, identity.number, offer.recipientName or identity.name, offer.canEdit and 1 or 0 })

        Identity.refresh(src, 'documents')

        if offer.from then
            Identity.refresh(offer.from, 'documents')

            TriggerClientEvent('royal-phone:client:notify', offer.from, {
                app = 'documents',
                title = 'Invite accepted',
                content = ('They joined "%s".'):format(offer.name or 'the document'),
            })
        end
    end
end)

---Raise an offer from another server file. Returns the token.
---@param data table { kind, to, from, name, ... }
---@param notification table passed through to the recipient's phone
---@return string|nil token
function PhoneOffer(data, notification)
    sweepOffers()

    local token = newOffer(data)

    notification.offer = notification.offer or {}
    notification.offer.kind = data.kind
    notification.offer.token = token
    notification.duration = 0
    notification.sound = true

    TriggerClientEvent('royal-phone:client:notify', data.to, notification)

    return token
end

AddEventHandler('playerDropped', function()
    for token, offer in pairs(offers) do
        if offer.to == source or offer.from == source then offers[token] = nil end
    end
end)

--#endregion

--#region bank

lib.callback.register('royal-phone:server:bank:transfer', function(src, data)
    local player = getPlayer(src)
    if not player or type(data) ~= 'table' then return false end

    local amount = math.floor(tonumber(data.amount) or 0)
    if amount <= 0 then return { error = 'Enter an amount.' } end

    local number = tostring(data.number or '')
    local mine = getNumber(src)
    if number == '' or number == mine then return { error = 'Pick someone else.' } end

    local targetIdentifier = MySQL.scalar.await(
        'SELECT identifier FROM royal_phone_numbers WHERE number = ? LIMIT 1', { number }
    )
    if not targetIdentifier then return { error = 'No account on that number.' } end

    if type(Bridge.MoveMoney) ~= 'function' then return { error = 'Transfers are not set up.' } end

    -- Debit first: if the sender cannot cover it nobody is credited.
    if not Bridge.MoveMoney(src, 'bank', -amount, 'royal-phone transfer') then
        return { error = 'Not enough in the bank.' }
    end

    local senderName = ('%s %s'):format(player.firstname or '', player.lastname or '')
    local targetSrc = Bridge.GetSourceByIdentifier and Bridge.GetSourceByIdentifier(targetIdentifier) or nil

    if targetSrc then
        Bridge.MoveMoney(targetSrc, 'bank', amount, 'royal-phone transfer')
    else
        -- Offline: park it so the credit is not lost when they next log in.
        MySQL.insert.await(
            'INSERT INTO royal_phone_bank_pending (identifier, amount, label) VALUES (?, ?, ?)',
            { targetIdentifier, amount, ('Transfer from %s'):format(senderName) }
        )
    end

    logTransaction(player.identifier, ('Transfer to %s'):format(number), -amount)
    logTransaction(targetIdentifier, ('Transfer from %s'):format(senderName), amount)

    if targetSrc then
        TriggerClientEvent('royal-phone:client:notify', targetSrc, {
            app = 'bank',
            title = 'Transfer received',
            content = ('%s sent you $%s'):format(senderName, amount),
            sound = true,
        })
    end

    return { ok = true }
end)

--#endregion

--#region exports

---Send a phone notification to a player from any other resource.
---@param src number
---@param data table see royal-phone/client/main.lua Notify
exports('Notify', function(src, data)
    TriggerClientEvent('royal-phone:client:notify', src, data)
end)

---Send a message from a "system" number (jobs, services, bots).
exports('SendMessage', function(src, from, content)
    local number = getNumber(src)
    if not number then return false end

    local id = MySQL.insert.await(
        'INSERT INTO royal_phone_messages (sender, receiver, content) VALUES (?, ?, ?)',
        { from, number, content }
    )

    TriggerClientEvent('royal-phone:client:newMessage', src, {
        id = id,
        sender = from,
        receiver = number,
        content = content,
        name = from,
        createdAt = os.time() * 1000,
    })

    return id
end)

exports('GetNumber', function(src) return getNumber(src) end)

---Add a line to a character's Bank activity feed. This is the hook for your
---banking, payroll or shop resources.
---@param src number
---@param label string
---@param amount number negative for money out
exports('AddTransaction', function(src, label, amount)
    local player = getPlayer(src)
    if not player then return false end

    logTransaction(player.identifier, label, tonumber(amount) or 0)
    return true
end)

--#endregion

--#region test command

---Fire a phone notification at yourself, for checking the toast, the grouping
---and the routing without waiting for something real to happen.
---   /testnotify                  one from the phone
---   /testnotify bank             one from a given app
---   /testnotify messages 4       four in a row, to see them group
lib.addCommand('testnotify', {
    help = 'Send yourself a test phone notification',
    params = {
        { name = 'app', type = 'string', help = 'App id (bank, messages, lifeinvader, ...)', optional = true },
        { name = 'count', type = 'number', help = 'How many to send', optional = true },
    },
}, function(source, args)
    local app = args.app or 'dialer'
    local count = math.min(math.max(args.count or 1, 1), 10)

    for index = 1, count do
        SetTimeout(index * 400, function()
            TriggerClientEvent('royal-phone:client:notify', source, {
                app = app,
                title = ('Test notification %d'):format(index),
                content = ('Sent from /testnotify · app "%s"'):format(app),
                sound = true,
            })
        end)
    end
end)

---Write yourself a real text, so the Messages routing and unread badge can be
---checked end to end rather than just the toast.
lib.addCommand('testmessage', {
    help = 'Send yourself a test text message',
    params = {
        { name = 'content', type = 'string', help = 'What it should say', optional = true },
    },
}, function(source, args)
    local number = getNumber(source)
    if not number then return end

    local content = args.content or 'Test message from /testmessage'
    local from = 'Dispatch'

    local id = MySQL.insert.await(
        'INSERT INTO royal_phone_messages (sender, receiver, content) VALUES (?, ?, ?)',
        { from, number, content }
    )

    TriggerClientEvent('royal-phone:client:newMessage', source, {
        id = id,
        sender = from,
        receiver = number,
        content = content,
        name = from,
        createdAt = os.time() * 1000,
    })
end)

--#endregion
