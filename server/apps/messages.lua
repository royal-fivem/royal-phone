lib.callback.register('royal-phone:server:sendMessage', function(src, number, content, extra)
    if type(number) ~= 'string' or type(content) ~= 'string' then return false end

    content = content:sub(1, 500)
    if content == '' then return false end

    local identity = Identity.get(src)
    if not identity then return false end

    local sender = identity.number
    local senderName = identity.name ~= '' and identity.name or sender

    extra = extra or {}

    local kind = tostring(extra.kind or 'text'):sub(1, 12)
    local seconds = tonumber(extra.seconds)
    local media = extra.media and tostring(extra.media) or nil
    local location = extra.location and json.encode(extra.location):sub(1, 255) or nil

    -- Attachments still arriving as data URLs (a photo picked in the UI, or a
    -- clip whose upload was skipped) get one more chance at the upload host.
    if media and media:find('^data:') then
        media = RemoteUpload(media, { kind = kind, seconds = seconds }) or media
    end

    if media and #media > Config.MediaMaxLength then
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
            local memberSrc = Identity.sourceFromNumber(row.number)
            if memberSrc and memberSrc ~= src then
                TriggerClientEvent('royal-phone:client:newMessage', memberSrc, payloadFor(id))
            end
        end

        Phone.Emit('messageSent', payloadFor(id), { source = src, group = groupId })

        return { id = id, createdAt = os.time() * 1000 }
    end

    local id = MySQL.insert.await(INSERT, { sender, number, content, kind, media, seconds, location })

    local target = Identity.sourceFromNumber(number)
    if target then
        TriggerClientEvent('royal-phone:client:newMessage', target, payloadFor(id))
    end

    Phone.Emit('messageSent', payloadFor(id), { source = src, receiverSource = target })

    return { id = id, createdAt = os.time() * 1000 }
end)

--- Hands a recorded clip to the upload host and gives the UI back a URL.
--- Returns nil when remote storage is off or the host failed, and the client
--- keeps the clip inline.
lib.callback.register('royal-phone:server:uploadVoice', function(src, data, seconds)
    if type(data) ~= 'string' or #data > Config.MediaMaxLength then return nil end
    if not Identity.get(src) then return nil end

    -- Loose on purpose: the recorder's mime carries a codecs parameter.
    if not data:find('^data:audio/') then return nil end

    return RemoteUpload(data, { kind = 'voice', seconds = tonumber(seconds) })
end)

RegisterNetEvent('royal-phone:server:markRead', function(number)
    local identity = Identity.get(source)
    if not identity or type(number) ~= 'string' then return end

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

local function groupOwners(id)
    local rows = MySQL.query.await(
        'SELECT identifier FROM royal_phone_group_members WHERE group_id = ?', { id }
    ) or {}

    local out = {}
    for _, row in ipairs(rows) do out[#out + 1] = row.identifier end
    return out
end

local function refreshGroup(id)
    for _, owner in ipairs(groupOwners(id)) do
        Identity.refreshOwner(owner, 'data')
    end
end

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
    local identity = Identity.get(src)
    if not identity or type(members) ~= 'table' then return false end

    name = type(name) == 'string' and name:sub(1, 48):gsub('^%s+', ''):gsub('%s+$', '') or ''
    if name == '' then return { error = 'Give the group a name.' } end
    if #members == 0 then return { error = 'Pick at least one person.' } end

    local id = MySQL.insert.await(
        'INSERT INTO royal_phone_groups (identifier, name, members) VALUES (?, ?, ?)',
        { identity.owner, name, json.encode(members) }
    )

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

RegisterNetEvent('royal-phone:server:updateGroup', function(id, name, avatar)
    local identity = Identity.get(source)
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
            CleanAvatar(avatar), id,
        })
    end

    refreshGroup(id)
end)

lib.callback.register('royal-phone:server:inviteToGroup', function(src, data)
    local identity = Identity.get(src)
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
    local identity = Identity.get(source)
    if not identity or not id then return end

    local owner = MySQL.scalar.await('SELECT identifier FROM royal_phone_groups WHERE id = ? LIMIT 1', { id })
    if owner ~= identity.owner then return end
    if number == identity.number then return end

    local members = groupOwners(id)

    MySQL.update.await('DELETE FROM royal_phone_group_members WHERE group_id = ? AND number = ?', { id, number })

    for _, key in ipairs(members) do Identity.refreshOwner(key, 'data') end
end)

RegisterNetEvent('royal-phone:server:removeGroup', function(id)
    local identity = Identity.get(source)
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

PhoneOfferHandlers['group'] = function(src, identity, offer)
    MySQL.insert.await([[
        INSERT IGNORE INTO royal_phone_group_members (group_id, identifier, number)
        VALUES (?, ?, ?)
    ]], { offer.group, identity.owner, identity.number })

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
end
