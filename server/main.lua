Phone = Phone or {}

---@param identifier string
---@param label string
---@param amount number negative for money out
function Phone.LogTransaction(identifier, label, amount)
    if not identifier then return end

    MySQL.insert('INSERT INTO royal_phone_bank_transactions (identifier, label, amount) VALUES (?, ?, ?)', {
        identifier, tostring(label):sub(1, 64), math.floor(amount),
    })
end

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

lib.callback.register('royal-phone:server:getData', function(src)
    local player = Bridge.GetPlayer(src)
    if not player then return nil end

    local identity = Identity.get(src)

    if not identity then
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

    claimPending(src, player.identifier)

    local transactions = MySQL.query.await([[
        SELECT id, label, amount, UNIX_TIMESTAMP(created_at) * 1000 AS createdAt
        FROM royal_phone_bank_transactions
        WHERE identifier = ?
        ORDER BY created_at DESC
        LIMIT 50
    ]], { player.identifier }) or {}

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

    for _, message in ipairs(messages) do
        if message.location then
            message.location = json.decode(message.location)
        end
    end

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
        sim = identity.serial,
        simOwner = identity.registeredTo,
        job = player.job,
        gang = player.gang,
        cash = player.cash,
        bank = player.bank,
        transactions = transactions,
        contacts = contacts,
        groups = groups,
        messages = messages,
        calls = calls,
        notes = notes and json.decode(notes) or {},
        photos = GetPhotos(owner),
    }
end)

RegisterNetEvent('royal-phone:server:saveNotes', function(notes)
    local identity = Identity.get(source)
    if not identity or type(notes) ~= 'table' then return end

    MySQL.insert([[
        INSERT INTO royal_phone_notes (identifier, notes) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE notes = VALUES(notes)
    ]], { identity.owner, json.encode(notes) })
end)

lib.callback.register('royal-phone:server:getNearby', function(src)
    local origin = GetEntityCoords(GetPlayerPed(src))
    local range = Config.NearbyRange or 12.0
    local found = {}

    for _, id in ipairs(GetPlayers()) do
        local other = tonumber(id)

        if other and other ~= src then
            local coords = GetEntityCoords(GetPlayerPed(other))

            if #(origin - coords) <= range then
                local player = Bridge.GetPlayer(other)

                if player then
                    found[#found + 1] = {
                        source = other,
                        name = ('%s %s'):format(player.firstname or '', player.lastname or ''),
                        number = Identity.number(other),
                    }
                end
            end
        end
    end

    return found
end)

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

local function claimOffer(src, token)
    local offer = offers[token]
    if not offer then return nil end

    offers[token] = nil

    if offer.to ~= src then return nil end
    if os.time() - offer.at > OFFER_TTL then return nil end

    return offer
end

local function sweepOffers()
    local now = os.time()
    for token, offer in pairs(offers) do
        if now - offer.at > OFFER_TTL then offers[token] = nil end
    end
end

---@type table<string, fun(src: number, identity: table, offer: table)>
PhoneOfferHandlers = {}

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

    local identity = Identity.get(src)
    if not identity then return end

    local handler = PhoneOfferHandlers[offer.kind]
    if handler then handler(src, identity, offer) end
end)

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

---@param src number
---@param data table see royal-phone/client/main.lua Notify
exports('Notify', function(src, data)
    TriggerClientEvent('royal-phone:client:notify', src, data)
end)

exports('SendMessage', function(src, from, content)
    local number = Identity.number(src)
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

exports('GetNumber', function(src) return Identity.number(src) end)

---@param src number
---@param label string
---@param amount number negative for money out
exports('AddTransaction', function(src, label, amount)
    local player = Bridge.GetPlayer(src)
    if not player then return false end

    Phone.LogTransaction(player.identifier, label, tonumber(amount) or 0)
    return true
end)

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

lib.addCommand('testmessage', {
    help = 'Send yourself a test text message',
    params = {
        { name = 'content', type = 'string', help = 'What it should say', optional = true },
    },
}, function(source, args)
    local number = Identity.number(source)
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

