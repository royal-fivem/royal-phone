--- Remote media storage: sends a photo or voice clip to a host and returns the
--- URL, so the database holds a link instead of base64. Off unless
--- Config.MediaStorage is 'remote'.
---
--- The key lives HERE, not in config.lua — that file is a shared script, so
--- anything in it is downloaded by every client.
---
--- Defaults are Fivemanage. Both endpoints are used:
---   base64Url — JSON { base64, filename }, for media that reaches the server as
---               a data URL (camera shots from the phone's canvas, voice clips).
---   url       — multipart, which screencapture's remoteUpload posts to directly.
local Upload = {
    url = 'https://api.fivemanage.com/api/v3/file',
    base64Url = 'https://api.fivemanage.com/api/v3/file/base64',
    token = '',
    header = 'Authorization', -- 'x-api-key', ...
    tokenPrefix = '',         -- 'Bearer ', 'Bot ', ...
    field = 'file',           -- multipart field name
    timeout = 15000,
}

--- First string among the arguments. Varargs rather than a table, because a
--- table constructor full of nils is a table with holes, and ipairs stops at the
--- first one — which silently loses a URL sitting behind a missing key.
---@return string|nil
local function first(...)
    for i = 1, select('#', ...) do
        local value = select(i, ...)

        if type(value) == 'string' and value ~= '' then return value end
    end
end

--- Hosts disagree on what they call the URL, so try the usual keys, then a bare
--- URL as the whole body. Takes the reply as a string or already decoded, because
--- screencapture's remoteUpload hands back a table.
---@param body string|table
---@return string|nil
function RemoteUploadUrlFrom(body)
    local parsed = body

    if type(body) == 'string' then
        local ok, decoded = pcall(json.decode, body)

        if not ok or type(decoded) ~= 'table' then
            return body:match('^%s*(https?://[^%s"]+)%s*$')
        end

        parsed = decoded
    elseif type(body) ~= 'table' then
        return nil
    end

    local nested = type(parsed.data) == 'table' and parsed.data or {}
    local attachment = type(parsed.attachments) == 'table' and parsed.attachments[1] or {}

    return first(
        parsed.url, parsed.link, parsed.location, parsed.src,
        nested.url, nested.originalUrl, nested.link,
        type(attachment) == 'table' and attachment.url or nil
    )
end

---@return boolean
function RemoteUploadEnabled()
    return Config.MediaStorage == 'remote' and Upload.base64Url ~= ''
end

--- The multipart endpoint, for anything that uploads on its own — screencapture's
--- remoteUpload export posts the frame straight from the client, so a game
--- screenshot never round-trips through the server. Headers are built here, so
--- the key still never reaches a client script.
---@return string url, table headers, string field
function RemoteUploadTarget()
    local headers = {}

    if Upload.token ~= '' then
        headers[Upload.header] = Upload.tokenPrefix .. Upload.token
    end

    return Upload.url, headers, Upload.field
end

---@type table<string, string>
local FIX = { jpeg = 'jpg', mpeg = 'mp3', ['x-m4a'] = 'm4a' }

--- Uploads a data URL as JSON — no binary through PerformHttpRequest
---
--- Blocks the calling thread until the host answers or the timeout runs out, so
--- call it from a callback thread. nil means "store it inline instead" — remote
--- storage off, not a data URL, or the host failed.
---@param data string base64 data URL
---@param meta? { kind?: string, seconds?: number }
---@return string|nil url
function RemoteUpload(data, meta)
    if not RemoteUploadEnabled() or type(data) ~= 'string' then return nil end

    -- The header carries parameters as well as the mime — MediaRecorder produces
    -- 'data:audio/webm;codecs=opus;base64,...' — so read up to the comma and take
    -- the mime off the front of it.
    local header, payload = data:match('^data:([^,]*),(.+)$')
    if not header or not header:find('base64', 1, true) then return nil end

    local mime = header:match('^([%w%+%-%./]+)') or 'application/octet-stream'
    local tail = mime:match('/([%w%-]+)$') or 'bin'
    local extension = FIX[tail] or tail

    local name = ('%s_%d.%s'):format(
        (meta and meta.kind) or 'media', math.random(100000000, 999999999), extension
    )

    local headers = { ['Content-Type'] = 'application/json' }

    if Upload.token ~= '' then
        headers[Upload.header] = Upload.tokenPrefix .. Upload.token
    end

    local done, settled = promise.new(), false

    local function settle(value)
        if settled then return end
        settled = true
        done:resolve(value)
    end

    SetTimeout(Upload.timeout, function() settle(nil) end)

    PerformHttpRequest(Upload.base64Url, function(status, response)
        local url = status >= 200 and status < 300 and RemoteUploadUrlFrom(response) or nil

        if not url then
            -- The body says why (bad key, file too large, wrong endpoint), and
            -- guessing at that from a status code alone is a bad time.
            print(('[royal-phone] media upload failed (HTTP %s): %s')
                :format(status, tostring(response):sub(1, 300)))
        end

        settle(url)
    end, 'POST', json.encode({ base64 = payload, filename = name }), headers)

    return Citizen.Await(done)
end
