local CAPTURE_TIMEOUT = 10000

---@param src number
---@return string|nil base64 data URI
local function capture(src)
    if GetResourceState('screencapture') ~= 'started' then return nil end

    local done = promise.new()
    local settled = false

    local function settle(value)
        if settled then return end
        settled = true
        done:resolve(value)
    end

    SetTimeout(CAPTURE_TIMEOUT, function() settle(nil) end)

    exports.screencapture:serverCapture(src, {
        encoding = Config.PhotoEncoding,
        maxWidth = Config.PhotoMaxWidth,
        maxHeight = Config.PhotoMaxHeight,
    }, function(data)
        settle(type(data) == 'string' and data or nil)
    end)

    return Citizen.Await(done)
end

local LIMIT = math.max(1, math.floor(tonumber(Config.PhotoLimit) or 30))

--- Contacts point at a gallery photo by reference, so drop the reference with the photo.
---@param owner string
---@param id number
local function forgetReferences(owner, id)
    MySQL.update.await(
        'UPDATE royal_phone_contacts SET avatar = NULL WHERE identifier = ? AND avatar = ?',
        { owner, ('photo:%d'):format(id) }
    )
end

---@param owner string
local function trim(owner)
    local total = MySQL.scalar.await(
        'SELECT COUNT(*) FROM royal_phone_photos WHERE identifier = ?', { owner }
    ) or 0

    local excess = total - LIMIT
    if excess <= 0 then return end

    local rows = MySQL.query.await(([[
        SELECT id FROM royal_phone_photos
        WHERE identifier = ?
        ORDER BY created_at ASC, id ASC
        LIMIT %d
    ]]):format(excess), { owner }) or {}

    for _, row in ipairs(rows) do
        MySQL.update.await('DELETE FROM royal_phone_photos WHERE id = ?', { row.id })
        forgetReferences(owner, row.id)
    end
end

---@param owner string
---@return { id: number, url: string, takenAt: number }[]
function GetPhotos(owner)
    return MySQL.query.await(([[
        SELECT id, data AS url, UNIX_TIMESTAMP(created_at) * 1000 AS takenAt
        FROM royal_phone_photos
        WHERE identifier = ?
        ORDER BY created_at DESC, id DESC
        LIMIT %d
    ]]):format(LIMIT), { owner }) or {}
end

---@param src number
---@param data string base64 data URI
---@return table
local function store(src, data)
    local identity = Identity.get(src)
    if not identity then return { ok = false } end

    if type(data) ~= 'string' then return { ok = false, error = 'no image' } end

    if not data:find('^data:image/[%w%+%-%.]+;base64,') then
        return { ok = false, error = 'not an image' }
    end

    if #data > Config.PhotoMaxLength then
        return { ok = false, error = 'photo too large' }
    end

    local id = MySQL.insert.await(
        'INSERT INTO royal_phone_photos (identifier, data) VALUES (?, ?)',
        { identity.owner, data }
    )

    if not id then return { ok = false } end

    trim(identity.owner)

    return { ok = true, photo = { id = id, url = data, takenAt = os.time() * 1000 } }
end

lib.callback.register('royal-phone:server:savePhoto', function(src, data)
    return store(src, data)
end)

lib.callback.register('royal-phone:server:takePhoto', function(src)
    local data = capture(src)
    if not data then return { ok = false, error = 'capture failed' } end

    return store(src, data)
end)

lib.callback.register('royal-phone:server:deletePhoto', function(src, id)
    id = tonumber(id)
    if not id then return false end

    local identity = Identity.get(src)
    if not identity then return false end

    MySQL.update.await(
        'DELETE FROM royal_phone_photos WHERE id = ? AND identifier = ?',
        { id, identity.owner }
    )

    forgetReferences(identity.owner, id)

    return true
end)
