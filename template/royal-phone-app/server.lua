local APP_ID = 'example'
local phone = exports['royal-phone']

-- Everything here goes through royal-phone's server exports. Each one that
-- takes a target accepts a player source or a phone number.

lib.callback.register('royal-phone-app:getContacts', function(source)
    return phone:GetContacts(source) or {}
end)

RegisterNetEvent('royal-phone-app:textMe', function()
    local src = source

    -- Lands in the Messages app as a thread from "Example". Works for offline
    -- numbers too: phone:SendMessage('555-0134', ...).
    phone:SendMessage(src, 'Example', 'Hello from the server side of your app.')
end)

RegisterNetEvent('royal-phone-app:ping', function()
    local src = source

    SetTimeout(500, function()
        -- Arrives in the page as RoyalPhone.on('pong', ...).
        phone:SendAppMessage(src, APP_ID, 'pong', { time = os.date('%H:%M:%S') })
    end)
end)

-- Per-phone storage. Keyed to the SIM card when SIMs are on, so a stolen SIM
-- carries the note with it.
lib.callback.register('royal-phone-app:loadNote', function(source)
    return phone:GetAppData(source, APP_ID, 'note') or ''
end)

lib.callback.register('royal-phone-app:saveNote', function(source, note)
    if type(note) ~= 'string' then return false end
    return phone:SetAppData(source, APP_ID, 'note', note:sub(1, 500))
end)

-- ── Listening to the phone ────────────────────────────────────────────────
--
-- Server-side phone events. Always AddEventHandler, never RegisterNetEvent:
-- these are fired on the server only, and a net event could be faked by a
-- client.

AddEventHandler('royal-phone:messageSent', function(message, meta)
    -- message: { id, sender, receiver, content, kind, media, createdAt, ... }
    -- meta:    { source = sender's source or nil, receiverSource?, group? }
    if message.content == '!example' and meta.source then
        phone:Notify(meta.source, {
            app = APP_ID,
            title = 'Example',
            content = 'You said the magic word. Tap to open.',
            route = { tab = 'home' },
        })
    end
end)

AddEventHandler('royal-phone:callEnded', function(call)
    -- call: { id, callerSource, receiverSource, callerNumber, receiverNumber,
    --         answered, duration, reason, endedBy }
end)
