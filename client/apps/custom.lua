--- Custom apps: any resource can put an app on the home screen.
---
--- The app's UI is a page from the registering resource, shown in an iframe.
--- See docs/custom-apps.html and the template in template/royal-phone-app.

---@type table<string, table> id -> app
local registered = {}

---@type string[] registration order, so the home screen stays stable
local order = {}

---@return table[]
local function list()
    local out = {}

    for i = 1, #order do
        out[#out + 1] = registered[order[i]]
    end

    return out
end

local pushing = false

local function push()
    if pushing then return end
    pushing = true

    SetTimeout(0, function()
        pushing = false
        PhoneSend('customApps', list())
    end)
end

--- `ui/index.html` -> `https://cfx-nui-my-resource/ui/index.html`. Full URLs
--- (https://, nui://, data:) are left alone.
---@param path string|nil
---@param resource string
---@return string|nil
local function resolve(path, resource)
    if type(path) ~= 'string' or path == '' then return nil end
    if path:find('^%a[%w+.-]*:') then return path end

    path = path:gsub('^%./', ''):gsub('^/', '')

    -- `my-resource/ui/index.html`, the LB-style form, already names the resource.
    local first = path:match('^([^/]+)/')
    if first and first ~= resource and GetResourceState(first) ~= 'missing' then
        return ('https://cfx-nui-%s'):format(path)
    end

    if first == resource then path = path:sub(#resource + 2) end

    return ('https://cfx-nui-%s/%s'):format(resource, path)
end

---@param app table {
---   id:           string  -- unique, also the notification `app` id
---   name?:        string  -- home screen label, defaults to the id
---   icon?:        string  -- image, a path inside your resource or a full url
---   ui:           string  -- page shown in the iframe, a path inside your resource or a full url
---   background?:  string  -- css colour or tailwind class behind the frame, default black
---   gradient?:    string  -- tailwind class for the icon tile when there is no icon
---   description?: string
--- }
---@return boolean registered
local function CustomApp(app)
    if type(app) ~= 'table' then
        warn('CustomApp: expected a table')
        return false
    end

    if type(app.id) ~= 'string' or not app.id:match('^[%w_%-%.]+$') then
        warn('CustomApp: id must be letters, numbers, - _ or .')
        return false
    end

    local resource = GetInvokingResource() or GetCurrentResourceName()
    local ui = resolve(app.ui, resource)

    if not ui then
        warn(('CustomApp: %s has no ui'):format(app.id))
        return false
    end

    local existing = registered[app.id]
    if existing and existing.resource ~= resource and GetResourceState(existing.resource) == 'started' then
        warn(('CustomApp: id "%s" is already taken by %s'):format(app.id, existing.resource))
        return false
    end

    if not existing then
        order[#order + 1] = app.id
    end

    registered[app.id] = {
        id = app.id,
        name = app.name or app.label or app.id,
        icon = resolve(app.icon, resource),
        ui = ui,
        background = app.background,
        gradient = app.gradient,
        description = app.description,
        resource = resource,
    }

    push()
    return true
end

---@param id string
---@return boolean removed
local function RemoveCustomApp(id)
    if not registered[id] then return false end

    registered[id] = nil

    for i = 1, #order do
        if order[i] == id then
            table.remove(order, i)
            break
        end
    end

    push()
    return true
end

---@param id string app id
---@param type string
---@param data any
local function SendAppMessage(id, type, data)
    if not registered[id] then return false end

    PhoneSend('customAppMessage', { id = id, type = type, data = data })
    return true
end

---@param id string
---@param route? any handed to the app as RoyalPhone.route / the 'route' message
local function OpenCustomApp(id, route)
    if not registered[id] then return false end

    if not PhoneIsOpen() then
        exports[GetCurrentResourceName()]:Open()
        if not PhoneIsOpen() then return false end
    end

    PhoneSend('openApp', { app = id, props = route })
    return true
end

exports('CustomApp', CustomApp)
exports('AddCustomApp', CustomApp)
exports('SendAppMessage', SendAppMessage)
exports('OpenCustomApp', OpenCustomApp)
exports('RemoveCustomApp', RemoveCustomApp)
exports('GetCustomApps', list)

---@return table[]
function PhoneCustomApps()
    return list()
end

--- Server -> one player's app (server export SendAppMessage).
RegisterNetEvent('royal-phone:client:appMessage', function(id, type, data)
    SendAppMessage(id, type, data)
end)

--- The UI reports which app is on screen, so resources can react to their app
--- being opened or left.
local current = nil

RegisterNUICallback('appChanged', function(data, cb)
    local app = data and data.app or nil
    if type(app) ~= 'string' then app = nil end

    if app ~= current then
        if current then TriggerEvent('royal-phone:appClosed', current) end
        current = app
        if app then TriggerEvent('royal-phone:appOpened', app) end
    end

    cb(1)
end)

CreateThread(function()
    Wait(0)
    TriggerEvent('royal-phone:client:registerApps')
end)

AddEventHandler('onResourceStart', function(resource)
    if resource == GetCurrentResourceName() then return end

    SetTimeout(500, function()
        TriggerEvent('royal-phone:client:registerApps')
    end)
end)

-- An app goes away with the resource that registered it.
AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then return end

    local removed = false

    for i = #order, 1, -1 do
        local id = order[i]

        if registered[id] and registered[id].resource == resource then
            registered[id] = nil
            table.remove(order, i)
            removed = true
        end
    end

    if removed then push() end
end)
