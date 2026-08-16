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

---@param app table {
---   id:          string  -- unique, also the notification `app` id
---   name?:       string  -- home screen label, defaults to the id
---   icon?:       string  -- image url, falls back to a gradient tile
---   ui:          string  -- page shown in the iframe
---   background?: string  -- tailwind class behind the frame
---   gradient?:   string  -- tailwind class for the icon tile without an icon
--- }
---@return boolean registered
local function CustomApp(app)
    if type(app) ~= 'table' then
        warn('CustomApp: expected a table')
        return false
    end

    if type(app.id) ~= 'string' or app.id == '' then
        warn('CustomApp: missing id')
        return false
    end

    if type(app.ui) ~= 'string' or app.ui == '' then
        warn(('CustomApp: %s has no ui url'):format(app.id))
        return false
    end

    if not registered[app.id] then
        order[#order + 1] = app.id
    end

    registered[app.id] = {
        id = app.id,
        name = app.name or app.label or app.id,
        icon = app.icon,
        ui = app.ui,
        background = app.background,
        gradient = app.gradient,
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
local function OpenCustomApp(id)
    if not registered[id] then return false end

    if not PhoneIsOpen() then
        exports[GetCurrentResourceName()]:Open()
        if not PhoneIsOpen() then return false end
    end

    PhoneSend('openApp', { app = id })
    return true
end

exports('CustomApp', CustomApp)
exports('SendAppMessage', SendAppMessage)
exports('OpenCustomApp', OpenCustomApp)
exports('RemoveCustomApp', RemoveCustomApp)
exports('GetCustomApps', list)

---@return table[]
function PhoneCustomApps()
    return list()
end

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
