local isOpen = false
local isReady = false
local animRunning = false
local phoneProp = nil
local cachedData = nil

local typing = false

local PROP_MODEL = `prop_amb_phone`
local ANIM_DICT = 'cellphone@'
local ANIM_TEXT = 'cellphone_text_read_base'
local ANIM_CALL = 'cellphone_call_listen_base'
local TYPE_DICT = 'amb@code_human_wander_texting_fat@male@base'
local ANIM_TYPE = 'static'

---@type string|nil
local animClip = nil
---@type string|nil
local animDict = nil

---@param action string
---@param data any
function PhoneSend(action, data)
    SendNUIMessage({ action = action, data = data })
end

local function safeBridge(fn, fallback)
    if type(Bridge[fn]) ~= 'function' then return fallback end
    return Bridge[fn]()
end

---@param name string
---@return number
local function itemCount(name)
    if Config.Inventory == 'ox_inventory' then
        return exports.ox_inventory:Search('count', name) or 0
    elseif Config.Inventory == 'qb-inventory' then
        return exports['qb-inventory']:HasItem(name) == true and 1 or 0
    end

    return 1
end

local function canOpen()
    if not isReady then return false end
    if not safeBridge('IsLoaded', true) then return false end
    if Config.BlockWhenDead and safeBridge('IsDead', false) then return false end
    if Config.BlockWhenCuffed and safeBridge('IsCuffed', false) then return false end
    if IsPedSwimming(cache.ped) then return false end

    if Config.RequireItem and itemCount(Config.ItemName) < 1 then
        lib.notify({ type = 'error', description = 'You do not have a phone.' })
        return false
    end

    return true
end

function PhoneApplyFocus()
    if not isOpen then
        SetNuiFocus(false, false)
        SetNuiFocusKeepInput(false)
        return
    end

    SetNuiFocus(true, true)
    SetNuiFocusKeepInput(Config.AllowMovement and not typing)
end

---@return boolean
function PhoneIsOpen()
    return isOpen
end

local stopAnimation

local function attachProp()
    if phoneProp and DoesEntityExist(phoneProp) then return end

    lib.requestModel(PROP_MODEL)

    phoneProp = CreateObject(PROP_MODEL, GetEntityCoords(cache.ped), true, true, false)
    AttachEntityToEntity(
        phoneProp, cache.ped, GetPedBoneIndex(cache.ped, 28422),
        0.0, 0.0, 0.0, 0.0, 0.0, 0.0, true, true, false, true, 1, true
    )

    SetModelAsNoLongerNeeded(PROP_MODEL)
end

---@return number|nil the phone in the hand, nil when the animation is off
function PhonePropEntity()
    if phoneProp and DoesEntityExist(phoneProp) then return phoneProp end

    return nil
end

---@param clip string
---@param dict string? defaults to the main cellphone dictionary
local function playClip(clip, dict)
    if not Config.UseAnimation then return end

    dict = dict or ANIM_DICT
    if animClip == clip and animDict == dict then return end

    lib.requestAnimDict(dict)

    TaskPlayAnim(cache.ped, dict, clip, 3.0, -1, -1, 49, 0, false, false, false)

    animClip = clip
    animDict = dict
    animRunning = true

    attachProp()
    RemoveAnimDict(dict)
end

function PhoneRefreshAnimation()
    if not Config.UseAnimation then return end

    local onCall = PhoneCallActive and PhoneCallActive()
    local photoClip = PhoneCameraClip and PhoneCameraClip()

    if photoClip then
        playClip(photoClip)
    elseif onCall then
        playClip(ANIM_CALL)
    elseif isOpen then
        if typing then
            playClip(ANIM_TYPE, TYPE_DICT)
        else
            playClip(ANIM_TEXT)
        end
    else
        stopAnimation()
    end
end

stopAnimation = function ()
    if not animRunning then return end
    animRunning = false

    if animClip then
        StopAnimTask(cache.ped, animDict or ANIM_DICT, animClip, 1.0)
        animClip = nil
        animDict = nil
    end

    if phoneProp and DoesEntityExist(phoneProp) then
        DeleteEntity(phoneProp)
    end
    phoneProp = nil
end

local function pushTime()
    PhoneSend('time', {
        hour = GetClockHours(),
        minute = GetClockMinutes(),
        day = GetClockDayOfWeek(),
        date = GetClockDayOfMonth(),
        month = GetClockMonth() + 1,
    })
end

local function Close(silent)
    if not isOpen then return end
    isOpen = false
    typing = false

    TriggerEvent('royal-phone:client:phoneClosed')
    TriggerEvent('royal-phone:phoneClosed')

    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)

    PhoneRefreshAnimation()

    if not silent then PhoneSend('setOpen', false) end
end

local function Open()
    if isOpen then return end
    if not canOpen() then return end

    isOpen = true

    cachedData = lib.callback.await('royal-phone:server:getData', false)

    if not cachedData or cachedData.noSim then
        isOpen = false

        lib.notify({
            type = 'error',
            description = cachedData and cachedData.reason == 'no_phone'
                and 'You do not have a phone.'
                or 'No SIM card. Put one in the phone.',
        })

        return
    end

    local lifeinvader = lib.callback.await('royal-phone:server:li:getData', false)
    local documents = lib.callback.await('royal-phone:server:docs:getData', false)

    typing = false
    PhoneApplyFocus()
    PhoneRefreshAnimation()

    PhoneSend('bootstrap', {
        player = safeBridge('GetPlayerData', nil),
        data = cachedData,
        lifeinvader = lifeinvader,
        documents = documents,
        customApps = PhoneCustomApps and PhoneCustomApps() or nil,
        config = { peekDuration = Config.PeekDuration },
    })
    pushTime()
    PhoneSend('setOpen', true)
    TriggerEvent('royal-phone:phoneOpened')

    CreateThread(function()
        while isOpen do
            Wait(0)

            DisableControlAction(0, 200, true)
            DisableControlAction(0, 322, true)
            DisableControlAction(0, 199, true)

            if Config.AllowMovement then
                if not PhoneCameraActive then
                    DisableControlAction(0, 1, true)
                    DisableControlAction(0, 2, true)
                    DisableControlAction(0, 220, true)
                    DisableControlAction(0, 221, true)
                end

                DisableControlAction(0, 106, true)
                DisableControlAction(0, 80, true)

                DisableControlAction(0, 24, true)
                DisableControlAction(0, 25, true)
                DisableControlAction(0, 47, true)
                DisableControlAction(0, 58, true)
                DisableControlAction(0, 140, true)
                DisableControlAction(0, 141, true)
                DisableControlAction(0, 142, true)
                DisableControlAction(0, 257, true)
                DisableControlAction(0, 263, true)
                DisableControlAction(0, 264, true)
                DisableControlAction(0, 37, true)
                DisableControlAction(0, 45, true)

                if typing then DisableAllControlActions(0) end
            end
        end
    end)

    CreateThread(function()
        local ticks = 0

        while isOpen do
            Wait(1000)
            if Config.BlockWhenDead and safeBridge('IsDead', false) then
                Close()
                break
            end

            ticks += 1
            if ticks % 60 == 0 then pushTime() end
        end
    end)
end

local function Toggle()
    if isOpen then Close() else Open() end
end

RegisterNUICallback('ready', function(_, cb)
    isReady = true
    cb(1)
end)

RegisterNUICallback('close', function(_, cb)
    Close(true)
    cb(1)
end)

RegisterNUICallback('requestOpen', function(_, cb)
    Open()
    cb(1)
end)

RegisterNUICallback('typing', function(data, cb)
    local active = data and data.active == true

    if active ~= typing then
        typing = active
        PhoneApplyFocus()
        PhoneRefreshAnimation()
    end

    cb(1)
end)

RegisterNUICallback('bank:transfer', function(data, cb)
    cb(lib.callback.await('royal-phone:server:bank:transfer', false, data) or false)
end)

RegisterNUICallback('saveNotes', function(data, cb)
    TriggerServerEvent('royal-phone:server:saveNotes', data.notes)
    cb(1)
end)

RegisterNUICallback('saveLayout', function(data, cb)
    TriggerServerEvent('royal-phone:server:saveLayout', data.layout)

    cb(1)
end)

RegisterNUICallback('setWaypoint', function(data, cb)
    SetNewWaypoint(data.x + 0.0, data.y + 0.0)
    cb(1)
end)

RegisterNUICallback('shareLocation', function(_, cb)
    local coords = GetEntityCoords(cache.ped)

    local street, crossing = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
    local label = GetStreetNameFromHashKey(street)

    if crossing and crossing ~= 0 then
        local cross = GetStreetNameFromHashKey(crossing)
        if cross and cross ~= '' then label = ('%s & %s'):format(label, cross) end
    end

    local zone = GetLabelText(GetNameOfZone(coords.x, coords.y, coords.z))
    if zone and zone ~= '' and zone ~= 'NULL' then label = ('%s, %s'):format(label, zone) end

    cb({ label = label, x = coords.x, y = coords.y })
end)

---@param data table {
---   app?:      string  -- app id, drives the icon and colour ('messages', 'bank', ...)
---   title:     string  -- bold first line
---   content?:  string  -- body line
---   avatar?:   string  -- image url shown instead of the app icon
---   duration?: number  -- ms on screen (defaults to Config.NotifyDuration)
---   sound?:    boolean -- play the notification blip
---   route?:    table   -- payload handed to the app when the notification is
---                      -- tapped, so it can open the right screen. Messages
---                      -- takes { number = '555-0134' }, the phone app takes
---                      -- { tab = 'calls' | 'keypad' | 'contacts' }.
--- }
function Notify(data)
    data = data or {}
    if data.duration == nil then data.duration = Config.NotifyDuration end
    if not isOpen and not Config.NotifyWhenClosed then return end
    PhoneSend('notify', data)
    TriggerEvent('royal-phone:notification', data)
end

exports('Notify', Notify)
exports('Open', Open)
exports('Close', function() Close() end)
exports('Toggle', Toggle)
exports('IsOpen', function() return isOpen end)

exports('useItem', function()
    Open()
end)

RegisterNetEvent('royal-phone:client:notify', function(data)
    Notify(data)
end)

RegisterNUICallback('answerOffer', function(data, cb)
    TriggerServerEvent('royal-phone:server:answerOffer', data)
    cb(1)
end)

---@type table<string, boolean>
local refreshPending = {}

local REFRESH_SOURCES = {
    data = 'royal-phone:server:getData',
    documents = 'royal-phone:server:docs:getData',
    lifeinvader = 'royal-phone:server:li:getData',
}

RegisterNetEvent('royal-phone:client:refresh', function(slice)
    slice = slice or 'data'

    local callback = REFRESH_SOURCES[slice]
    if not callback or not isOpen or refreshPending[slice] then return end

    refreshPending[slice] = true

    SetTimeout(400, function()
        refreshPending[slice] = nil
        if not isOpen then return end

        local payload = lib.callback.await(callback, false)
        if not payload then return end

        PhoneSend('refresh', { [slice] = payload })
    end)
end)

AddEventHandler('royal-phone:client:playerUnloaded', function()
    Close(false)
end)

RegisterCommand(Config.Command, function()
    Toggle()
end, false)

RegisterKeyMapping(Config.Command, 'Royal Phone - Toggle', 'keyboard', Config.OpenKey)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end

    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
    stopAnimation()
end)

