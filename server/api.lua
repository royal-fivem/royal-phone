--- Public server API for other resources.
---
--- Every export that takes a `target` accepts either a player source (number)
--- or a phone number (string). A phone number works for players who are
--- offline too, wherever that makes sense: messages and contacts are written
--- to the database and show up the next time the phone opens.
---
--- Events this file and the apps fire for other resources to listen to are
--- listed in docs/api.html. Listen with AddEventHandler, never
--- RegisterNetEvent: they are server-local, and registering them as net events
--- would let any client fake them.

Phone = Phone or {}

local APP_DATA_MAX = 65535

---@class PhoneTarget
---@field owner string   who owns the data: SIM serial with SIM cards on, character identifier otherwise
---@field number string
---@field source number|nil online player holding that phone, if any

---@param target number|string player source or phone number
---@return PhoneTarget|nil
function Phone.Resolve(target)
    if type(target) == 'number' then
        local identity = Identity.get(target)
        if not identity then return nil end

        return { owner = identity.owner, number = identity.number, source = target }
    end

    if type(target) ~= 'string' or target == '' then return nil end

    local src = Identity.sourceFromNumber(target)

    if src then
        local identity = Identity.get(src)
        if identity then return { owner = identity.owner, number = identity.number, source = src } end
    end

    local owner = MySQL.scalar.await(
        'SELECT identifier FROM royal_phone_numbers WHERE number = ? LIMIT 1', { target }
    )
    if not owner then return nil end

    return { owner = owner, number = target, source = nil }
end

--- Fires a server-local event for other resources. Wrapped so one broken
--- listener cannot break the phone action that triggered it.
---@param name string without the `royal-phone:` prefix
---@param ... any
function Phone.Emit(name, ...)
    local args = table.pack(...)
    local ok, err = pcall(function() TriggerEvent('royal-phone:' .. name, table.unpack(args, 1, args.n)) end)
    if not ok then print(('^1[royal-phone]^7 listener for %s failed: %s'):format(name, err)) end
end

---@param value any
---@return string|nil
local function appId(value)
    if type(value) ~= 'string' then return nil end
    if not value:match('^[%w_%-%.]+$') or #value > 64 then return nil end
    return value
end

-- ── Identity ────────────────────────────────────────────────────────────────

---@param src number
---@return string|nil
exports('GetNumber', function(src) return Identity.number(src) end)

---@param number string
---@return number|nil source of the online player holding that number
exports('GetSourceFromNumber', function(number)
    if type(number) ~= 'string' then return nil end
    return Identity.sourceFromNumber(number)
end)

---@param target number|string
---@return { number: string, owner: string, source: number|nil, name: string|nil, serial: string|nil }|nil
exports('GetIdentity', function(target)
    local resolved = Phone.Resolve(target)
    if not resolved then return nil end

    local identity = resolved.source and Identity.get(resolved.source) or nil

    return {
        number = resolved.number,
        owner = resolved.owner,
        source = resolved.source,
        name = identity and identity.name or nil,
        serial = identity and identity.serial or nil,
    }
end)

-- ── Notifications ───────────────────────────────────────────────────────────

--- Notifications are not stored: an offline target gets nothing and this
--- returns false.
---@param target number|string
---@param data table see Notify in client/main.lua
---@return boolean delivered
local function notify(target, data)
    if type(data) ~= 'table' then return false end

    local src = target

    if type(target) == 'string' then
        src = Identity.sourceFromNumber(target)
    end

    if type(src) ~= 'number' or not GetPlayerName(src) then return false end

    TriggerClientEvent('royal-phone:client:notify', src, data)
    return true
end

exports('Notify', notify)
exports('SendNotification', notify)

-- ── Messages ────────────────────────────────────────────────────────────────

---@param target number|string who receives it
---@param from string sender shown in the thread: a phone number or a name ('Maze Bank')
---@param content string
---@param extra? table { kind?: string, media?: string, seconds?: number, location?: { label: string, x: number, y: number }, name?: string }
---@return number|false id
exports('SendMessage', function(target, from, content, extra)
    local resolved = Phone.Resolve(target)
    if not resolved then return false end

    from = tostring(from or ''):sub(1, 24)
    content = tostring(content or ''):sub(1, 500)
    if from == '' or content == '' then return false end

    extra = type(extra) == 'table' and extra or {}

    local kind = tostring(extra.kind or 'text'):sub(1, 12)
    local media = extra.media and tostring(extra.media) or nil
    local seconds = tonumber(extra.seconds)
    local location = extra.location and json.encode(extra.location):sub(1, 255) or nil

    if media and #media > Config.MediaMaxLength then media = nil end

    local id = MySQL.insert.await(
        'INSERT INTO royal_phone_messages (sender, receiver, content, kind, media, seconds, location) VALUES (?, ?, ?, ?, ?, ?, ?)',
        { from, resolved.number, content, kind, media, seconds, location }
    )
    if not id then return false end

    local message = {
        id = id,
        sender = from,
        receiver = resolved.number,
        content = content,
        kind = kind,
        media = media,
        seconds = seconds,
        location = extra.location,
        name = extra.name or from,
        createdAt = os.time() * 1000,
    }

    if resolved.source then
        TriggerClientEvent('royal-phone:client:newMessage', resolved.source, message)
    end

    Phone.Emit('messageSent', message, { source = nil, receiverSource = resolved.source })

    return id
end)

---@param target number|string whose phone to read
---@param with? string only the thread with this number (or 'group:<id>')
---@param limit? number newest first, default 50, at most 200
---@return table[]|nil
exports('GetMessages', function(target, with, limit)
    local resolved = Phone.Resolve(target)
    if not resolved then return nil end

    limit = math.min(math.max(math.floor(tonumber(limit) or 50), 1), 200)

    local rows

    if type(with) == 'string' and with ~= '' then
        rows = MySQL.query.await([[
            SELECT id, sender, receiver, content, kind, media, seconds, location, `read`,
                   UNIX_TIMESTAMP(created_at) * 1000 AS createdAt
            FROM royal_phone_messages
            WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
            ORDER BY created_at DESC, id DESC
            LIMIT ?
        ]], { resolved.number, with, with, resolved.number, limit })
    else
        rows = MySQL.query.await([[
            SELECT id, sender, receiver, content, kind, media, seconds, location, `read`,
                   UNIX_TIMESTAMP(created_at) * 1000 AS createdAt
            FROM royal_phone_messages
            WHERE sender = ? OR receiver = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
        ]], { resolved.number, resolved.number, limit })
    end

    rows = rows or {}

    for _, row in ipairs(rows) do
        if row.location then row.location = json.decode(row.location) end
    end

    return rows
end)

-- ── Contacts ────────────────────────────────────────────────────────────────

---@param target number|string
---@return { id: number, name: string, number: string, avatar: string|nil }[]|nil
exports('GetContacts', function(target)
    local resolved = Phone.Resolve(target)
    if not resolved then return nil end

    return MySQL.query.await(
        'SELECT id, name, number, avatar FROM royal_phone_contacts WHERE identifier = ? ORDER BY name ASC',
        { resolved.owner }
    ) or {}
end)

--- Adds a contact, or renames the existing one with the same number.
---@param target number|string
---@param contact { name: string, number: string, avatar?: string }
---@return number|false id
exports('AddContact', function(target, contact)
    local resolved = Phone.Resolve(target)
    if not resolved or type(contact) ~= 'table' then return false end

    local name = tostring(contact.name or ''):sub(1, 48)
    local number = tostring(contact.number or ''):sub(1, 24)
    if name == '' or number == '' then return false end

    local avatar = CleanAvatar(contact.avatar)

    local existing = MySQL.scalar.await(
        'SELECT id FROM royal_phone_contacts WHERE identifier = ? AND number = ? LIMIT 1',
        { resolved.owner, number }
    )

    local id = existing

    if existing then
        MySQL.update.await(
            'UPDATE royal_phone_contacts SET name = ?, avatar = COALESCE(?, avatar) WHERE id = ?',
            { name, avatar, existing }
        )
    else
        id = MySQL.insert.await(
            'INSERT INTO royal_phone_contacts (identifier, name, number, avatar) VALUES (?, ?, ?, ?)',
            { resolved.owner, name, number, avatar }
        )
    end

    if not id then return false end

    Identity.refreshOwner(resolved.owner, 'data')
    Phone.Emit('contactAdded', { owner = resolved.owner, number = resolved.number, source = resolved.source },
        { id = id, name = name, number = number })

    return id
end)

---@param target number|string
---@param number string the contact's number
---@return boolean removed
exports('RemoveContact', function(target, number)
    local resolved = Phone.Resolve(target)
    if not resolved or type(number) ~= 'string' then return false end

    local affected = MySQL.update.await(
        'DELETE FROM royal_phone_contacts WHERE identifier = ? AND number = ?',
        { resolved.owner, number }
    ) or 0

    if affected > 0 then Identity.refreshOwner(resolved.owner, 'data') end

    return affected > 0
end)

-- ── Calls ───────────────────────────────────────────────────────────────────

---@param src number
---@return { number: string, with: number, outgoing: boolean, answered: boolean, since: number }|nil
exports('GetCall', function(src)
    return PhoneGetCall and PhoneGetCall(src) or nil
end)

---@param src number
---@return boolean ended
exports('EndCall', function(src)
    return PhoneEndCall and PhoneEndCall(src, 'hangup') or false
end)

-- ── Bank ────────────────────────────────────────────────────────────────────

---@param src number
---@param label string
---@param amount number negative for money out
exports('AddTransaction', function(src, label, amount)
    local player = Bridge.GetPlayer(src)
    if not player then return false end

    Phone.LogTransaction(player.identifier, label, tonumber(amount) or 0)
    return true
end)

-- ── Custom apps ─────────────────────────────────────────────────────────────

--- Pushes a message into a custom app's iframe on one player's phone. The app
--- receives it as RoyalPhone.on(type, fn).
---@param src number
---@param app string custom app id
---@param type string
---@param data any
exports('SendAppMessage', function(src, app, type_, data)
    if type(src) ~= 'number' or not appId(app) or type(type_) ~= 'string' then return false end

    TriggerClientEvent('royal-phone:client:appMessage', src, app, type_, data)
    return true
end)

--- Small per-phone storage for custom apps, keyed by the phone (SIM or
--- character), so the data follows the SIM card like everything else.
---@param target number|string
---@param app string
---@param key string
---@return any value decoded, or nil
exports('GetAppData', function(target, app, key)
    local resolved = Phone.Resolve(target)
    if not resolved or not appId(app) or type(key) ~= 'string' then return nil end

    local raw = MySQL.scalar.await(
        'SELECT value FROM royal_phone_app_data WHERE identifier = ? AND app = ? AND `key` = ? LIMIT 1',
        { resolved.owner, app, key:sub(1, 64) }
    )
    if not raw then return nil end

    local ok, value = pcall(json.decode, raw)
    return ok and value or nil
end)

---@param target number|string
---@param app string
---@param key string
---@param value any anything json.encode accepts; nil deletes the key
---@return boolean saved
exports('SetAppData', function(target, app, key, value)
    local resolved = Phone.Resolve(target)
    if not resolved or not appId(app) or type(key) ~= 'string' then return false end

    key = key:sub(1, 64)

    if value == nil then
        MySQL.update.await(
            'DELETE FROM royal_phone_app_data WHERE identifier = ? AND app = ? AND `key` = ?',
            { resolved.owner, app, key }
        )
        return true
    end

    local encoded = json.encode(value)
    if #encoded > APP_DATA_MAX then return false end

    MySQL.insert.await([[
        INSERT INTO royal_phone_app_data (identifier, app, `key`, value) VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE value = VALUES(value)
    ]], { resolved.owner, app, key, encoded })

    return true
end)
