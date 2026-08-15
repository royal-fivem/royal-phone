PhoneCameraActive = false

---@class PhoneCameraState
---@field cam number|nil handle of the scripted cam
---@field anchor number|nil entity the selfie lens is hanging off, if any
---@field look vector3|nil last look input read, held through cursor mode
---@field front boolean selfie mode
---@field zoom number 0 (wide) to 1 (tight)
---@field flash boolean fire a light on capture
---@field cursor boolean cursor mode rather than camera mode
---@field flashUntil number game timer value the flash light burns out at
local state = {
    cam = nil,
    anchor = nil,
    look = nil,
    front = false,
    zoom = 0.0,
    flash = false,
    cursor = false,
    flashUntil = 0,
}

local FOV_WIDE, FOV_TIGHT = 75.0, 22.0

---@type table<string, vector3>
local OFFSET = {
    rear = vec3(0.0, 0.42, 0.28),
    front = vec3(0.0, 0.72, 0.22),
}

local PROP_OFFSET = vec3(0.0, 0.0, 0.04)

local SELFIE = { yaw = 45.0, pitch = 32.0 }

---@class PhoneCameraFlash
---@field ms number how long the light burns
---@field distance number metres in front of the phone, along the lens
---@field selfie number the same for the selfie lens, which points at a subject
---@field range number
---@field intensity number
---@field selfieIntensity number lower, because the subject is right on top of it
local FLASH = {
    ms = 260,
    distance = 0.8,
    selfie = 0.12,
    range = 7.0,
    intensity = 14.0,
    selfieIntensity = 4.0,
}

---@type table<string, string[]>
local POSE = {
    rear = { 'cellphone_photo_idle', 'cellphone_horizontal_base' },
    selfie = { 'cellphone_photo_hold_up', 'cellphone_photo_idle' },
}

local BLOCKED = {
    24, 25, 257, 263,
    47, 264,
    14, 15, 16, 17,
    241, 242,
    261, 262, 348,
    19,
}

---@type table<number, boolean>
local PHONE_MODELS = {
    [`prop_amb_phone`] = true,
    [`prop_npc_phone`] = true,
    [`prop_npc_phone_02`] = true,
    [`prop_phone_ing`] = true,
}

local function fovFor(level)
    return FOV_WIDE - (FOV_WIDE - FOV_TIGHT) * level
end

---@return number
local function angleDelta(from, to)
    return (to - from + 180.0) % 360.0 - 180.0
end

---@return number
local function clampAngle(angle, centre, limit)
    local delta = angleDelta(centre, angle)

    return centre + math.min(limit, math.max(-limit, delta))
end

---@return number|nil
local function prop()
    return PhonePropEntity and PhonePropEntity() or nil
end

---@type number[], number
local hidden, hiddenAt = {}, 0

---@return number[]
local function phonesOnPed()
    local now = GetGameTimer()

    if now - hiddenAt < 500 then return hidden end
    hiddenAt = now

    hidden = {}

    for _, object in ipairs(GetGamePool('CObject')) do
        if PHONE_MODELS[GetEntityModel(object)] and GetEntityAttachedTo(object) == cache.ped then
            hidden[#hidden + 1] = object
        end
    end

    return hidden
end

---@type string|nil 'rear' | 'selfie'
local pose = nil

---@type table<string, string|false>
local resolvedClip = {}

---@return string|nil
function PhoneCameraClip()
    if not pose then return nil end

    local cached = resolvedClip[pose]
    if cached ~= nil then return cached or nil end

    local candidates = POSE[pose]

    lib.requestAnimDict('cellphone@')

    resolvedClip[pose] = false

    for i = 1, #candidates do
        if GetAnimDuration('cellphone@', candidates[i]) > 0.0 then
            resolvedClip[pose] = candidates[i]
            break
        end
    end

    return resolvedClip[pose] or nil
end

---@param wanted string|nil 'rear' | 'selfie' | nil to hand the pose back
local function setPose(wanted)
    if pose == wanted then return end

    pose = wanted

    if PhoneRefreshAnimation then PhoneRefreshAnimation() end
end

local function place()
    if not state.cam then return end

    local anchor = state.front and prop() or nil

    if anchor then
        AttachCamToEntity(state.cam, anchor, PROP_OFFSET.x, PROP_OFFSET.y, PROP_OFFSET.z, true)
    else
        local offset = state.front and OFFSET.front or OFFSET.rear

        AttachCamToPedBone(state.cam, cache.ped, 31086, offset.x, offset.y, offset.z, true)
    end

    state.anchor = anchor
    SetCamFov(state.cam, fovFor(state.zoom))
end

local function refreshAnchor()
    if not state.front then return end
    if state.anchor == prop() then return end

    place()
end

local function aim()
    if not state.cam then return end

    if not state.cursor then state.look = GetGameplayCamRot(2) end

    local rot = state.look
    if not rot then return end

    if state.front then
        local facing = GetEntityHeading(cache.ped) + 180.0

        local yaw = clampAngle(rot.z + 180.0, facing, SELFIE.yaw)
        local pitch = math.min(SELFIE.pitch, math.max(-SELFIE.pitch, rot.x))

        SetCamRot(state.cam, pitch, rot.y, yaw, 2)
    else
        SetCamRot(state.cam, rot.x, rot.y, rot.z, 2)
    end
end

local function hideFromLens()
    local phones = phonesOnPed()

    for i = 1, #phones do
        if not DoesEntityExist(phones[i]) then goto continue end

        SetEntityVisible(phones[i], false, false)
        SetEntityAlpha(phones[i], 0, false)
        SetEntityLocallyInvisible(phones[i])

        ::continue::
    end

    if state.front then return end

    SetEntityLocallyInvisible(cache.ped)
end

local function drawFlash()
    if not state.cam or GetGameTimer() >= state.flashUntil then return end

    local phone = prop()
    local from = phone and GetEntityCoords(phone) or GetCamCoord(state.cam)

    local rot = GetCamRot(state.cam, 2)

    local pitch, yaw = math.rad(rot.x), math.rad(rot.z)
    local cosPitch = math.cos(pitch)
    local forward = vec3(-math.sin(yaw) * cosPitch, math.cos(yaw) * cosPitch, math.sin(pitch))

    local at = from + forward * (state.front and FLASH.selfie or FLASH.distance)
    local intensity = state.front and FLASH.selfieIntensity or FLASH.intensity

    DrawLightWithRange(at.x, at.y, at.z, 255, 255, 255, FLASH.range, intensity)
end

local function push()
    SendNUIMessage({
        action = 'cameraState',
        data = {
            front = state.front,
            zoom = state.zoom,
            flash = state.flash,
            cursor = state.cursor,
        },
    })
end

local function applyFocus()
    if state.cursor then
        SetNuiFocus(true, true)
        SetNuiFocusKeepInput(false)
    else
        SetNuiFocus(false, false)
        SetNuiFocusKeepInput(false)
    end
end

local function setCursor(cursor)
    if state.cursor == cursor then return end

    state.cursor = cursor
    applyFocus()
    push()
end

local function toggleCursor()
    setCursor(not state.cursor)
end

local function setFront(front)
    if state.front == front then return end

    state.front = front

    setPose(front and 'selfie' or 'rear')
    place()
    push()
end

local function setZoom(zoom)
    zoom = math.min(1.0, math.max(0.0, zoom))
    if zoom == state.zoom then return end

    state.zoom = zoom

    if state.cam then SetCamFov(state.cam, fovFor(zoom)) end

    push()
end

local function setFlash(flash)
    if state.flash == flash then return end

    state.flash = flash
    push()
end

local function readControls()
    if state.cursor then return end

    if IsDisabledControlJustPressed(0, 19) then
        toggleCursor()
        return
    end

    if IsDisabledControlJustPressed(0, 241) then
        setZoom(state.zoom + 0.08)
    elseif IsDisabledControlJustPressed(0, 242) then
        setZoom(state.zoom - 0.08)
    end

    if IsDisabledControlJustPressed(0, 25) then
        SendNUIMessage({ action = 'cameraShoot' })
    elseif IsDisabledControlJustPressed(0, 348) then
        setFront(not state.front)
    elseif IsDisabledControlJustPressed(0, 47) then
        setFlash(not state.flash)
    end
end

local function start(data)
    if PhoneCameraActive then return end

    state.front = data and data.front == true
    state.zoom = math.min(1.0, math.max(0.0, tonumber(data and data.zoom) or 0.0))
    state.flash = data and data.flash == true
    state.cursor = false
    state.flashUntil = 0
    state.anchor = nil
    state.look = GetGameplayCamRot(2)

    setPose(state.front and 'selfie' or 'rear')

    state.cam = CreateCamWithParams(
        'DEFAULT_SCRIPTED_CAMERA',
        GetEntityCoords(cache.ped),
        GetGameplayCamRot(2),
        fovFor(state.zoom), false, 0
    )

    place()
    SetCamActive(state.cam, true)
    RenderScriptCams(true, true, 400, true, true)

    PhoneCameraActive = true
    applyFocus()
    push()

    CreateThread(function()
        while PhoneCameraActive do
            Wait(0)

            for i = 1, #BLOCKED do
                DisableControlAction(0, BLOCKED[i], true)
            end

            refreshAnchor()
            aim()
            hideFromLens()
            drawFlash()
            readControls()

            HideHudComponentThisFrame(19)
            DisplayRadar(false)
        end
    end)
end

local function stop()
    if not PhoneCameraActive then return end

    PhoneCameraActive = false
    state.cursor = false
    state.flashUntil = 0
    state.anchor = nil
    state.look = nil

    setPose(nil)

    RenderScriptCams(false, true, 400, true, true)

    if state.cam then
        SetCamActive(state.cam, false)
        DestroyCam(state.cam, false)
        state.cam = nil
    end

    DisplayRadar(true)
    SetEntityVisible(cache.ped, true, false)

    for i = 1, #hidden do
        if DoesEntityExist(hidden[i]) then
            SetEntityVisible(hidden[i], true, false)
            ResetEntityAlpha(hidden[i])
        end
    end

    hidden, hiddenAt = {}, 0

    if PhoneApplyFocus then PhoneApplyFocus() end
end

RegisterNUICallback('camera:start', function(data, cb)
    start(data)
    cb(1)
end)

RegisterNUICallback('camera:stop', function(_, cb)
    stop()
    cb(1)
end)

RegisterNUICallback('camera:set', function(data, cb)
    if data then
        if data.front ~= nil then setFront(data.front == true) end
        if data.zoom ~= nil then setZoom(tonumber(data.zoom) or 0.0) end
        if data.flash ~= nil then setFlash(data.flash == true) end
    end

    cb(1)
end)

RegisterNUICallback('camera:cursor', function(data, cb)
    if data and data.cursor ~= nil then
        setCursor(data.cursor == true)
    else
        toggleCursor()
    end

    cb(1)
end)

RegisterNUICallback('camera:flash', function(_, cb)
    if PhoneCameraActive and state.flash then
        state.flashUntil = GetGameTimer() + FLASH.ms
    end

    cb(1)
end)

RegisterNUICallback('camera:save', function(data, cb)
    local result = lib.callback.await('royal-phone:server:savePhoto', false, data and data.data)

    cb(result or { ok = false })
end)

RegisterNUICallback('takePhoto', function(_, cb)
    if GetResourceState('screencapture') ~= 'started' then
        cb({ ok = false })
        return
    end

    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'setOpen', data = false })

    CreateThread(function()
        Wait(50)

        local result = lib.callback.await('royal-phone:server:takePhoto', false)

        if PhoneApplyFocus then PhoneApplyFocus() end
        SendNUIMessage({ action = 'setOpen', data = true })

        cb(result or { ok = false })
    end)
end)

RegisterNUICallback('deletePhoto', function(data, cb)
    lib.callback.await('royal-phone:server:deletePhoto', false, data and data.id)
    cb(1)
end)

AddEventHandler('royal-phone:client:stopCamera', stop)
AddEventHandler('royal-phone:client:playerUnloaded', stop)
AddEventHandler('royal-phone:client:phoneClosed', stop)

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then stop() end
end)

exports('StopCamera', stop)
