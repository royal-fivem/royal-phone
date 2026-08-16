local CAPTURE_TIMEOUT = 15000

---@return table settle-once promise helpers
local function pending()
    local done, settled = promise.new(), false

    local function settle(value)
        if settled then return end
        settled = true
        done:resolve(value)
    end

    SetTimeout(CAPTURE_TIMEOUT, function() settle(nil) end)

    return done, settle
end

---@return table capture options shared by both paths
local function options()
    return {
        encoding = Config.PhotoEncoding,
        maxWidth = Config.PhotoMaxWidth,
        maxHeight = Config.PhotoMaxHeight,
    }
end

---@param src number
---@return string|nil base64 data URI
local function capture(src)
    if GetResourceState('screencapture') ~= 'started' then return nil end

    local done, settle = pending()

    exports.screencapture:serverCapture(src, options(), function(data)
        settle(type(data) == 'string' and data or nil)
    end)

    return Citizen.Await(done)
end

--- screencapture uploads the frame itself, so the image never becomes base64 and
--- never crosses the server. The API key is added here, server-side.
---@param src number
---@return string|nil url
local function captureRemote(src)
    if GetResourceState('screencapture') ~= 'started' then return nil end

    local url, headers, field = RemoteUploadTarget()
    local opts = options()

    opts.headers = headers
    opts.formField = field
    opts.filename = ('photo_%d'):format(math.random(1e8, 1e9 - 1))

    local done, settle = pending()

    exports.screencapture:remoteUpload(src, url, opts, function(response)
        settle(RemoteUploadUrlFrom(response))
    end, 'blob')

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

--- The row holds either the frame as base64 or the upload host's URL — the
--- gallery reads one column and does not care which.
---@param owner string
---@param stored string
---@return table
local function insert(owner, stored)
    local id = MySQL.insert.await(
        'INSERT INTO royal_phone_photos (identifier, data) VALUES (?, ?)',
        { owner, stored }
    )

    if not id then return { ok = false } end

    trim(owner)

    return { ok = true, photo = { id = id, url = stored, takenAt = os.time() * 1000 } }
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

    -- A failed upload stores the frame, so a photo is never lost to a dead host.
    return insert(identity.owner, RemoteUpload(data, { kind = 'photo' }) or data)
end

lib.callback.register('royal-phone:server:savePhoto', function(src, data)
    return store(src, data)
end)

lib.callback.register('royal-phone:server:takePhoto', function(src)
    local identity = Identity.get(src)
    if not identity then return { ok = false } end

    if RemoteUploadEnabled() then
        local url = captureRemote(src)
        if url then return insert(identity.owner, url) end

        -- Host down: fall through and keep the shot, base64 in the row.
    end

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
