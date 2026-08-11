--- The phone's camera.
---
--- A scripted camera attached to the player's head, aimed by their own look
--- input. The NUI draws the viewfinder furniture; everything you actually see
--- through it is the game, which is why the phone hides itself while this runs.
---
--- Global so client/main.lua can tell: while the camera is up the player has to
--- be able to look around, which is exactly the input the open phone otherwise
--- suppresses.
PhoneCameraActive = false

local cam = nil
local front = false
local zoom = 0.0

--- Field of view at each end of the zoom range. Lower is tighter.
local FOV_WIDE, FOV_TIGHT = 75.0, 22.0

--- SKEL_Head. Attaching to the bone rather than the entity means the camera
--- rides the head's own movement, so the shot follows the animation.
local HEAD_BONE = 31086

---Where the camera sits relative to the head, per mode.
---@type table<string, vector3>
local OFFSET = {
    rear = vec3(0.0, 0.42, 0.28),
    -- Far enough forward that the ped's face is actually in frame.
    front = vec3(0.0, 0.72, 0.22),
}

local function fovFor(level)
    return FOV_WIDE - (FOV_WIDE - FOV_TIGHT) * level
end

---Put the camera where the current mode says it goes.
local function place()
    if not cam then return end

    local offset = front and OFFSET.front or OFFSET.rear

    AttachCamToPedBone(cam, cache.ped, HEAD_BONE, offset.x, offset.y, offset.z, true)
    SetCamFov(cam, fovFor(zoom))
end

--#region lifecycle

local function start(data)
    if PhoneCameraActive then return end

    front = data and data.front == true
    zoom = data and tonumber(data.zoom) or 0.0

    cam = CreateCamWithParams(
        'DEFAULT_SCRIPTED_CAMERA',
        GetEntityCoords(cache.ped),
        GetGameplayCamRot(2),
        fovFor(zoom), false, 0
    )

    place()
    SetCamActive(cam, true)
    RenderScriptCams(true, true, 400, true, true)

    PhoneCameraActive = true

    -- Aim the camera from the player's own look, every frame. The gameplay
    -- camera keeps tracking behind the scenes even while ours is rendering, so
    -- this is what makes the mouse point the lens.
    CreateThread(function()
        while PhoneCameraActive do
            Wait(0)

            local rot = GetGameplayCamRot(2)

            if front then
                -- Turned around to face the ped: flip the pitch and swing the
                -- heading through 180, or a selfie would point at the back of
                -- their head and be upside down as you look up.
                SetCamRot(cam, -rot.x, rot.y, rot.z + 180.0, 2)
            else
                SetCamRot(cam, rot.x, rot.y, rot.z, 2)
            end

            -- The radar in the corner would end up in every photo.
            HideHudComponentThisFrame(19) -- weapon wheel
            DisplayRadar(false)

            -- Shooting and punching while framing a shot is not a thing.
            DisableControlAction(0, 24, true)
            DisableControlAction(0, 25, true)
            DisableControlAction(0, 257, true)
            DisableControlAction(0, 263, true)
        end
    end)
end

local function stop()
    if not PhoneCameraActive then return end

    PhoneCameraActive = false

    RenderScriptCams(false, true, 400, true, true)

    if cam then
        SetCamActive(cam, false)
        DestroyCam(cam, false)
        cam = nil
    end

    DisplayRadar(true)
end

--#endregion

--#region nui

RegisterNUICallback('camera:start', function(data, cb)
    start(data)
    cb(1)
end)

RegisterNUICallback('camera:stop', function(_, cb)
    stop()
    cb(1)
end)

RegisterNUICallback('camera:set', function(data, cb)
    local wasFront = front

    front = data and data.front == true
    zoom = math.min(1.0, math.max(0.0, tonumber(data and data.zoom) or 0.0))

    -- Only re-attach when the mode actually changed; a zoom is just a new FOV.
    if front ~= wasFront then
        place()
    elseif cam then
        SetCamFov(cam, fovFor(zoom))
    end

    cb(1)
end)

---Take the shot.
---
---The viewfinder has to be off screen for the capture or its own chrome ends up
---in the photo, so the UI is hidden, given a frame to actually disappear, and put
---back afterwards.
RegisterNUICallback('camera:capture', function(_, cb)
    if not PhoneCameraActive then
        cb({ ok = false })
        return
    end

    if GetResourceState('screencapture') ~= 'started' then
        cb({ ok = false, error = 'screencapture is not running' })
        return
    end

    SendNUIMessage({ action = 'cameraHud', data = false })
    SetNuiFocus(false, false)

    CreateThread(function()
        -- Two frames: one for React to paint the hidden state, one for the
        -- compositor to hand it to the game.
        Wait(50)

        exports['screencapture']:remoteUpload({ encoding = 'jpg', quality = 0.9 }, 'upload', function(url)
            SendNUIMessage({ action = 'cameraHud', data = true })
            SetNuiFocus(true, true)
            SetNuiFocusKeepInput(true)

            cb({ ok = url ~= nil, url = url })
        end)
    end)
end)

--#endregion

--#region safety

--- The camera must never outlive the phone. Any of these leaving it running
--- would strand the player looking through a camera they cannot turn off — the
--- viewfinder is NUI, so once the phone is gone there is nothing left to press.
AddEventHandler('royal-phone:client:stopCamera', stop)
AddEventHandler('royal-phone:client:playerUnloaded', stop)

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then stop() end
end)

exports('StopCamera', stop)

--#endregion
