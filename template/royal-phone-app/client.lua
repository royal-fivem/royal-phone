local APP_ID = 'example'

-- ── Register the app ──────────────────────────────────────────────────────
--
-- royal-phone fires this event when it starts and whenever another resource
-- starts, so the app reappears after either side restarts. Paths are relative
-- to this resource; full URLs work too.

local function register()
    exports['royal-phone']:CustomApp({
        id = APP_ID,
        name = 'Example',
        icon = 'ui/icon.svg',
        ui = 'ui/index.html',
        background = '#080c13',
    })
end

AddEventHandler('royal-phone:client:registerApps', register)

-- Covers this resource being restarted while the phone keeps running.
CreateThread(function()
    if GetResourceState('royal-phone') == 'started' then register() end
end)

-- ── Callbacks for the page (RoyalPhone.fetch in ui/app.js) ────────────────
--
-- Each RegisterNUICallback is reachable from the page as
-- RoyalPhone.fetch('<name>', data). Anything that needs the database or other
-- players goes on to the server with an ox_lib callback.

RegisterNUICallback('getContacts', function(_, cb)
    cb(lib.callback.await('royal-phone-app:getContacts', false) or {})
end)

RegisterNUICallback('textMe', function(_, cb)
    TriggerServerEvent('royal-phone-app:textMe')
    cb(true)
end)

RegisterNUICallback('ping', function(_, cb)
    TriggerServerEvent('royal-phone-app:ping')
    cb(true)
end)

RegisterNUICallback('loadNote', function(_, cb)
    cb(lib.callback.await('royal-phone-app:loadNote', false) or '')
end)

RegisterNUICallback('saveNote', function(data, cb)
    cb(lib.callback.await('royal-phone-app:saveNote', false, data and data.note or '') == true)
end)

-- ── Phone events ──────────────────────────────────────────────────────────

AddEventHandler('royal-phone:appOpened', function(app)
    if app ~= APP_ID then return end
    -- Your app came on screen: start polling, play an animation, ...
end)

AddEventHandler('royal-phone:appClosed', function(app)
    if app ~= APP_ID then return end
    -- And left it again.
end)

-- A command that opens the app straight on the contacts tab.
RegisterCommand('exampleapp', function()
    exports['royal-phone']:OpenCustomApp(APP_ID, { tab = 'contacts' })
end, false)
