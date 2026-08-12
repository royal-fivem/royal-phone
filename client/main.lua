local isOpen = false
local isReady = false
local animRunning = false
local phoneProp = nil
local cachedData = nil

---True while the UI has a text box focused. Movement is handed back to the game
---with SetNuiFocusKeepInput, which means keystrokes reach both — so typing has to
---take the keyboard back for as long as the caret is in an input.
local typing = false

---The live call, mirrored client-side so the keybinds know what to do without a
---round trip. `state` is 'incoming' | 'dialing' | 'active'.
---@type { number: string, name: string, state: string, channel: number? }|nil
local currentCall = nil

local PROP_MODEL = `prop_amb_phone`
local ANIM_DICT = 'cellphone@'
---Holding it in front of you, reading. Used whenever the phone is open.
local ANIM_TEXT = 'cellphone_text_read_base'
---Held to the ear. Used for the duration of a call, open or pocketed.
local ANIM_CALL = 'cellphone_call_listen_base'
---Thumb tapping the screen. Loops for as long as a text box has the caret.
---Lives in its own dictionary, unlike the other three.
local TYPE_DICT = 'amb@code_human_wander_texting_fat@male@base'
local ANIM_TYPE = 'static'

---Which animation is playing right now, so we only re-task the ped on a change.
---@type string|nil
local animClip = nil
---The dictionary `animClip` came from, so it can be stopped again.
---@type string|nil
local animDict = nil

--#region helpers

---Send a message into the NUI frame.
---@param action string
---@param data any
local function send(action, data)
    SendNUIMessage({ action = action, data = data })
end

---Cheap wrapper so bridge misses never hard-error the resource.
local function safeBridge(fn, fallback)
    if type(Bridge) ~= 'table' or type(Bridge[fn]) ~= 'function' then return fallback end
    local ok, result = pcall(Bridge[fn])
    if not ok then return fallback end
    return result
end

---How many of an item the player is carrying.
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

    -- The SIM is deliberately NOT checked here. It normally lives inside the
    -- phone item's own container, which is a separate inventory the client cannot
    -- see — a count on the player's own inventory reports zero even with a card
    -- sitting in the phone. The server resolves it properly and replies `noSim`.
    return true
end

---Apply the focus mode the phone should be in right now.
---
---With Config.AllowMovement the phone keeps the mouse for its own click targets
---but hands the keyboard and mouse-look back to the game, so the player can walk
---and drive. That is dropped while a text box is focused, otherwise WASD would
---both type and steer.
local function applyFocus()
    if not isOpen then
        SetNuiFocus(false, false)
        SetNuiFocusKeepInput(false)
        return
    end

    SetNuiFocus(true, true)
    SetNuiFocusKeepInput(Config.AllowMovement and not typing)
end

--- For client/camera.lua, which takes the mouse off the phone.
function PhoneApplyFocus()
    applyFocus()
end

--#endregion

--#region voice

---Put the player on a call channel, or take them off it with 0.
---
---pma-voice's call channel is the mechanism the whole phone leans on: both ends
---being handed the same channel number is what actually connects them. Guarded
---because a server without the resource should still get a working UI.
---@param channel number
local function setVoiceChannel(channel)
    if Config.Voice ~= 'pma-voice' then return end
    if GetResourceState('pma-voice') ~= 'started' then return end

    local ok = pcall(function()
        exports['pma-voice']:setCallChannel(channel)
    end)

    if not ok then
        print('^3[royal-phone]^7 pma-voice is running but setCallChannel failed — check its version.')
    end
end

--#endregion

--#region animation

-- Forward declaration: refreshAnimation needs to stop the animation, and
-- stopAnimation is defined after it for readability.
local stopAnimation

---Attach the phone prop, if it is not already on the hand.
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

---Play one of the phone clips, swapping cleanly if another is already running.
---@param clip string
---@param dict string? defaults to the main cellphone dictionary
local function playClip(clip, dict)
    if not Config.UseAnimation then return end

    dict = dict or ANIM_DICT
    if animClip == clip and animDict == dict then return end

    lib.requestAnimDict(dict)

    -- Blend between the two rather than stopping first, so going from reading to
    -- holding it to your ear is one movement instead of a snap back to idle.
    TaskPlayAnim(cache.ped, dict, clip, 3.0, -1, -1, 49, 0, false, false, false)

    animClip = clip
    animDict = dict
    animRunning = true

    attachProp()
    RemoveAnimDict(dict)
end

---Work out which clip the ped should be playing right now: the camera first,
---then a live call, then typing or reading while the phone is open.
local function refreshAnimation()
    if not Config.UseAnimation then return end

    local onCall = currentCall ~= nil and currentCall.state ~= 'incoming'
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

local function startAnimation()
    refreshAnimation()
end

--- For client/camera.lua, after it changes the pose.
function PhoneRefreshAnimation()
    refreshAnimation()
end

--#endregion

--#region open / close

---Push the current in-game clock into the UI. Called on open and every minute
---while open — never on a per-frame basis.
local function pushTime()
    send('time', {
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

    -- Announced, not acted on: anything that took over the screen has to put
    -- itself away now. The camera listens for this.
    TriggerEvent('royal-phone:client:phoneClosed')

    -- Call mode and peek mode are display-only: the phone stays on screen but the
    -- game gets the mouse straight back, so the player is never left with a
    -- cursor they did not ask for.
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)

    -- Not a flat stop: pocketing the phone mid-call leaves it at your ear.
    refreshAnimation()

    if not silent then send('setOpen', false) end
end

local function Open()
    if isOpen then return end
    if not canOpen() then return end

    isOpen = true

    -- Data is fetched once per open, never polled.
    cachedData = lib.callback.await('royal-phone:server:getData', false)

    -- The server refuses to hand over a phone identity without a registered SIM.
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
    applyFocus()
    startAnimation()

    send('bootstrap', {
        player = safeBridge('GetPlayerData', nil),
        data = cachedData,
        lifeinvader = lifeinvader,
        documents = documents,
        config = { peekDuration = Config.PeekDuration },
    })
    pushTime()
    send('setOpen', true)

    -- Two threads, both only alive while the phone is open.
    --
    -- Per-frame: swallow the pause menu so Escape reaches the UI (which closes
    -- the phone) instead of opening the GTA menu, plus the controls that must not
    -- fire while a phone is in the player's hand. Movement and mouse-look are
    -- deliberately left alone — that is the whole point of keep-input. No draw
    -- calls, so this costs almost nothing.
    CreateThread(function()
        while isOpen do
            Wait(0)

            DisableControlAction(0, 200, true) -- INPUT_FRONTEND_PAUSE
            DisableControlAction(0, 322, true) -- INPUT_FRONTEND_PAUSE_ALTERNATE
            DisableControlAction(0, 199, true) -- INPUT_FRONTEND_PAUSE (P)

            if Config.AllowMovement then
                -- The mouse belongs to the phone, so the camera is pinned. Every
                -- swipe across the screen would otherwise spin the player round.
                -- Movement is what stays with the game — not looking.
                --
                -- The camera app is the exception, and has to be: the mouse is
                -- how you aim the lens. See client/camera.lua.
                if not PhoneCameraActive then
                    DisableControlAction(0, 1, true)   -- look left/right
                    DisableControlAction(0, 2, true)   -- look up/down
                    DisableControlAction(0, 220, true) -- look left/right (alt stick)
                    DisableControlAction(0, 221, true) -- look up/down (alt stick)
                end

                DisableControlAction(0, 106, true) -- vehicle mouse control override
                DisableControlAction(0, 80, true)  -- vehicle cin cam

                DisableControlAction(0, 24, true)  -- attack
                DisableControlAction(0, 25, true)  -- aim
                DisableControlAction(0, 47, true)  -- weapon
                DisableControlAction(0, 58, true)  -- weapon (alt)
                DisableControlAction(0, 140, true) -- melee light
                DisableControlAction(0, 141, true) -- melee heavy
                DisableControlAction(0, 142, true) -- melee alternate
                DisableControlAction(0, 257, true) -- attack 2
                DisableControlAction(0, 263, true) -- melee attack 1
                DisableControlAction(0, 264, true) -- melee attack 2
                DisableControlAction(0, 37, true)  -- weapon wheel
                DisableControlAction(0, 45, true)  -- reload

                -- Typing hands the keyboard to the UI, so nothing may reach the
                -- game at all — including movement, or "was" walks the ped.
                if typing then DisableAllControlActions(0) end
            end
        end
    end)

    -- Once a second: keep the clock honest and close the phone if the player
    -- dies mid-call.
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

--#endregion

--#region nui callbacks

RegisterNUICallback('ready', function(_, cb)
    isReady = true
    cb(1)
end)

RegisterNUICallback('close', function(_, cb)
    Close(true)
    cb(1)
end)

-- The UI asks for focus back when the player taps the phone or the in-call pill
-- while it is pocketed: on screen, but not fully interactive.
RegisterNUICallback('requestOpen', function(_, cb)
    Open()
    cb(1)
end)

-- Call mode and peek mode never take focus: the phone is on screen but the game
-- keeps the mouse, so the player can carry on driving or shooting while a call
-- runs. Answer, decline and hang up are on the keybinds instead.
RegisterNUICallback('callMode', function(_, cb)
    if not isOpen then
        SetNuiFocus(false, false)
        SetNuiFocusKeepInput(false)
    end

    cb(1)
end)

-- The UI tells us when the caret enters and leaves a text box, so movement can
-- be handed back and forth without the player having to close the phone to walk.
RegisterNUICallback('typing', function(data, cb)
    local active = data and data.active == true

    if active ~= typing then
        typing = active
        applyFocus()
        refreshAnimation()
    end

    cb(1)
end)

RegisterNUICallback('call', function(data, cb)
    currentCall = { number = data.number, name = data.name or data.number, state = 'dialing' }
    refreshAnimation()
    TriggerServerEvent('royal-phone:server:call', data.number)
    cb(1)
end)

RegisterNUICallback('answerCall', function(_, cb)
    if currentCall then currentCall.state = 'active' end
    refreshAnimation()
    TriggerServerEvent('royal-phone:server:answerCall')
    cb(1)
end)

RegisterNUICallback('declineCall', function(_, cb)
    TriggerServerEvent('royal-phone:server:declineCall')
    cb(1)
end)

RegisterNUICallback('endCall', function(_, cb)
    TriggerServerEvent('royal-phone:server:endCall')
    cb(1)
end)

--- Mute the microphone for the call.
---
--- pma-voice has no "mute me" of its own, so this drops the player off the call
--- channel and puts them back on it — from the other end it is indistinguishable
--- from being muted, and it needs no changes to the voice resource.
RegisterNUICallback('setMuted', function(data, cb)
    local muted = data and data.muted == true

    if currentCall and currentCall.channel then
        setVoiceChannel(muted and 0 or currentCall.channel)
    end

    cb(1)
end)

RegisterNUICallback('getNearby', function(_, cb)
    cb(lib.callback.await('royal-phone:server:getNearby', false) or {})
end)

RegisterNUICallback('shareContact', function(data, cb)
    cb(lib.callback.await('royal-phone:server:shareContact', false, data) or false)
end)

RegisterNUICallback('bank:transfer', function(data, cb)
    cb(lib.callback.await('royal-phone:server:bank:transfer', false, data) or false)
end)

RegisterNUICallback('sendMessage', function(data, cb)
    local result = lib.callback.await(
        'royal-phone:server:sendMessage', false,
        data.number, data.content, {
            kind = data.kind,
            media = data.media,
            seconds = data.seconds,
            location = data.location,
        }
    )
    cb(result or false)
end)

RegisterNUICallback('createGroup', function(data, cb)
    local result = lib.callback.await('royal-phone:server:createGroup', false, data.name, data.members)
    cb(result or false)
end)

RegisterNUICallback('updateGroup', function(data, cb)
    TriggerServerEvent('royal-phone:server:updateGroup', data.id, data.name, data.avatar)
    cb(1)
end)

RegisterNUICallback('inviteToGroup', function(data, cb)
    cb(lib.callback.await('royal-phone:server:inviteToGroup', false, data) or false)
end)

RegisterNUICallback('kickFromGroup', function(data, cb)
    TriggerServerEvent('royal-phone:server:kickFromGroup', data.id, data.number)
    cb(1)
end)

RegisterNUICallback('removeGroup', function(data, cb)
    TriggerServerEvent('royal-phone:server:removeGroup', data.id)
    cb(1)
end)

--- Voice notes are recorded by the voice resource, not the browser: NUI has no
--- microphone. This fires when the player releases the record button so a voice
--- resource can capture and attach the clip; without one it is a no-op and the
--- message still lands as a placeholder.
RegisterNUICallback('voiceMessage', function(data, cb)
    TriggerEvent('royal-phone:client:voiceMessage', data.seconds)
    cb(1)
end)

RegisterNUICallback('addContact', function(data, cb)
    local result = lib.callback.await('royal-phone:server:addContact', false, data)
    cb(result or false)
end)

RegisterNUICallback('removeContact', function(data, cb)
    local result = lib.callback.await('royal-phone:server:removeContact', false, data.id)
    cb(result or false)
end)

RegisterNUICallback('markRead', function(data, cb)
    TriggerServerEvent('royal-phone:server:markRead', data.number)
    cb(1)
end)

RegisterNUICallback('saveNotes', function(data, cb)
    TriggerServerEvent('royal-phone:server:saveNotes', data.notes)
    cb(1)
end)

-- Home screen layout is per-character and lives in KVP: no DB round trip and
-- no server tick to save an icon being dragged one slot to the left.
RegisterNUICallback('saveLayout', function(data, cb)
    local player = safeBridge('GetPlayerData', nil)
    local key = ('royal-phone:layout:%s'):format(player and player.citizenid or 'default')
    SetResourceKvp(key, json.encode(data))
    cb(1)
end)

RegisterNUICallback('setWaypoint', function(data, cb)
    SetNewWaypoint(data.x + 0.0, data.y + 0.0)
    cb(1)
end)

--- Where the player is standing, named by the game's own street and zone data so
--- the message reads like a place rather than a pair of coordinates.
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

--- Turn a recorded clip into something playable.
---
--- With no upload host configured the data URL is handed straight back and gets
--- stored with the message — that works out of the box, which matters more here
--- than saving a few kilobytes. Config.VoiceMaxSeconds and Config.MediaMaxLength
--- are what stop that becoming a problem.
RegisterNUICallback('uploadVoice', function(data, cb)
    local body = data and data.data

    if type(body) ~= 'string' or body == '' then
        cb(nil)
        return
    end

    if #body > Config.MediaMaxLength then
        cb(nil)
        return
    end

    if not Config.VoiceUpload or Config.VoiceUpload == '' then
        cb({ url = body })
        return
    end

    PerformHttpRequest(Config.VoiceUpload, function(status, response)
        if status ~= 200 or not response then
            -- Host is down or misconfigured: keep the clip rather than lose it.
            cb({ url = body })
            return
        end

        local ok, parsed = pcall(json.decode, response)
        local url = ok and parsed and (parsed.url or parsed.link) or nil

        cb({ url = url or body })
    end, 'POST', json.encode({ audio = body, seconds = data.seconds }), {
        ['Content-Type'] = 'application/json',
        ['Authorization'] = Config.VoiceUploadToken or '',
    })
end)

RegisterNUICallback('voiceLimits', function(_, cb)
    cb({ maxSeconds = Config.VoiceMaxSeconds })
end)

--#endregion

--#region lifeinvader

RegisterNUICallback('li:createAccount', function(data, cb)
    cb(lib.callback.await('royal-phone:server:li:createAccount', false, data) or false)
end)

RegisterNUICallback('li:updateAccount', function(data, cb)
    TriggerServerEvent('royal-phone:server:li:updateAccount', data)
    cb(1)
end)

RegisterNUICallback('li:post', function(data, cb)
    cb(lib.callback.await('royal-phone:server:li:post', false, data) or false)
end)

RegisterNUICallback('li:story', function(data, cb)
    cb(lib.callback.await('royal-phone:server:li:post', false, { media = data.media, kind = 'story' }) or false)
end)

RegisterNUICallback('li:like', function(data, cb)
    TriggerServerEvent('royal-phone:server:li:like', data.id)
    cb(1)
end)

--- Reposts are counted client-side only; there is no table for them yet.
RegisterNUICallback('li:repost', function(_, cb) cb(1) end)

RegisterNUICallback('li:comment', function(data, cb)
    TriggerServerEvent('royal-phone:server:li:comment', data.id, data.text)
    cb(1)
end)

RegisterNUICallback('li:follow', function(data, cb)
    TriggerServerEvent('royal-phone:server:li:follow', data.handle, false)
    cb(1)
end)

RegisterNUICallback('li:block', function(data, cb)
    TriggerServerEvent('royal-phone:server:li:follow', data.handle, true)
    cb(1)
end)

RegisterNUICallback('li:list', function(data, cb)
    cb(lib.callback.await('royal-phone:server:li:list', false, data) or false)
end)

RegisterNUICallback('li:removeListing', function(data, cb)
    TriggerServerEvent('royal-phone:server:li:removeListing', data.id)
    cb(1)
end)

RegisterNUICallback('li:readNotifications', function(_, cb)
    TriggerServerEvent('royal-phone:server:li:readNotifications')
    cb(1)
end)

--- Re-pull the whole social payload. Called when the server says the feed moved
--- and when the player pulls to refresh, so other players' posts and follows show
--- up without closing the phone.
RegisterNUICallback('li:refresh', function(_, cb)
    cb(lib.callback.await('royal-phone:server:li:getData', false) or false)
end)


--#endregion

--#region events / exports

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
local function Notify(data)
    data = data or {}
    if data.duration == nil then data.duration = Config.NotifyDuration end
    if not isOpen and not Config.NotifyWhenClosed then return end
    send('notify', data)
end

exports('Notify', Notify)
exports('Open', Open)
exports('Close', function() Close() end)
exports('Toggle', Toggle)
exports('IsOpen', function() return isOpen end)

--- Hook for ox_inventory's `client.export` on the phone item, so using the item
--- from the inventory opens the phone. See ox_inventory_items.lua.
exports('useItem', function()
    Open()
end)

RegisterNetEvent('royal-phone:client:notify', function(data)
    Notify(data)
end)

RegisterNetEvent('royal-phone:client:newMessage', function(message)
    send('newMessage', message)
    Notify({
        app = 'messages',
        title = message.name or message.sender,
        content = message.content,
        sound = true,
        -- Tapping it opens this conversation, not just the app.
        route = { number = message.receiver and message.receiver:find('^group:') and message.receiver or message.sender },
    })
end)

--- A call ringing in does NOT open the phone. It rises to peek height showing the
--- call card, and the player answers or declines on the keybinds without losing
--- control of the game. Opening the phone here used to yank the mouse away mid
--- firefight, which is exactly what nobody wants from a ringing phone.
RegisterNetEvent('royal-phone:client:incomingCall', function(call)
    currentCall = { number = call.number, name = call.name, state = 'incoming' }

    send('incomingCall', {
        number = call.number,
        name = call.name,
        answerKey = Config.AnswerKey,
        declineKey = Config.DeclineKey,
    })
end)

--- Both sides get this the moment the receiver picks up: it is what joins the
--- voice channel and flips the caller from "dialing" to "connected".
RegisterNetEvent('royal-phone:client:callConnected', function(data)
    if not currentCall then return end

    currentCall.state = 'active'
    currentCall.channel = data and data.channel or nil

    if currentCall.channel then setVoiceChannel(currentCall.channel) end

    send('callConnected', { channel = currentCall.channel })
end)

RegisterNetEvent('royal-phone:client:callEnded', function(data)
    local reason = data and data.reason or 'hangup'
    local wasDialing = currentCall and currentCall.state == 'dialing'

    currentCall = nil
    setVoiceChannel(0)
    refreshAnimation()

    send('callEnded', { reason = reason })

    -- A dial that goes nowhere used to just vanish off the screen with no reason
    -- given, which reads as the phone being broken.
    if wasDialing then
        if reason == 'unavailable' then
            Notify({ app = 'dialer', title = 'Unavailable', content = 'They could not be reached.' })
        elseif reason == 'declined' then
            Notify({ app = 'dialer', title = 'Call declined', content = 'They turned down the call.' })
        end
    end
end)

RegisterNetEvent('royal-phone:client:contactShared', function(data)
    Notify({
        -- Contacts is its own app now, so this lands there rather than on a tab
        -- of the Phone app that no longer exists.
        app = 'contacts',
        title = 'Contact saved',
        content = ('%s · %s'):format(data.name or 'Unknown', data.number or ''),
        sound = true,
    })
end)

--- Offers — a shared contact, a document invite — are answered on the
--- notification itself, so the whole exchange happens on the phone rather than in
--- a separate dialog. See notifyStore.answerOffer.
RegisterNUICallback('answerOffer', function(data, cb)
    TriggerServerEvent('royal-phone:server:answerOffer', data)
    cb(1)
end)

---Re-pull one slice of the phone's data and push it into the UI.
---
---Only worth anything while the phone is on screen, and coalesced per slice so a
---burst of changes is one query rather than one each.
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

        -- Each slice is passed through exactly as its callback returned it, which
        -- is the same shape the bootstrap sends. Unwrapping one of them here made
        -- the documents store read `data.documents` off a bare array, get nil, and
        -- replace the whole list with an empty one — so accepting an invite looked
        -- like it deleted the document.
        send('refresh', { [slice] = payload })
    end)
end)

---Coalesce feed refreshes.
---
---The bump is broadcast to everyone, so a busy server liking posts would
---otherwise have every open phone fire the same set of queries at the same
---moment. One pull per window, and none at all unless the phone is actually on
---screen to show the result.
local refreshQueued = false

RegisterNetEvent('royal-phone:client:li:refresh', function()
    if not isOpen or refreshQueued then return end

    refreshQueued = true

    SetTimeout(1500, function()
        refreshQueued = false
        if not isOpen then return end

        local payload = lib.callback.await('royal-phone:server:li:getData', false)
        if payload then send('lifeinvader', payload) end
    end)
end)

AddEventHandler('royal-phone:client:playerUnloaded', function()
    Close(false)
end)

--#endregion

--#region boot

RegisterCommand(Config.Command, function()
    Toggle()
end, false)

RegisterKeyMapping(Config.Command, 'Royal Phone - Toggle', 'keyboard', Config.OpenKey)

-- Answer and decline as keybinds rather than click targets, so a call ringing in
-- while the phone is pocketed never needs to steal the mouse. Both are no-ops
-- unless there is actually a call to act on.
RegisterCommand('royalphone_answer', function()
    if not currentCall then return end

    if currentCall.state == 'incoming' then
        currentCall.state = 'active'
        TriggerServerEvent('royal-phone:server:answerCall')
        send('answerCall', true)
    end
end, false)

RegisterCommand('royalphone_decline', function()
    if not currentCall then return end

    if currentCall.state == 'incoming' then
        TriggerServerEvent('royal-phone:server:declineCall')
    else
        TriggerServerEvent('royal-phone:server:endCall')
    end
end, false)

RegisterKeyMapping('royalphone_answer', 'Royal Phone - Answer call', 'keyboard', Config.AnswerKey)
RegisterKeyMapping('royalphone_decline', 'Royal Phone - Decline / hang up', 'keyboard', Config.DeclineKey)

CreateThread(function()
    -- Ship the saved layout before the UI paints so the grid never flashes
    -- the default arrangement first.
    Wait(500)

    local player = safeBridge('GetPlayerData', nil)
    local key = ('royal-phone:layout:%s'):format(player and player.citizenid or 'default')
    local stored = GetResourceKvpString(key)

    if stored then
        local ok, layout = pcall(json.decode, stored)
        if ok and layout then send('layout', layout) end
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end

    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
    setVoiceChannel(0)
    stopAnimation()
end)

--#endregion
