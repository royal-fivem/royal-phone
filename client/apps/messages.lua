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

RegisterNUICallback('voiceMessage', function(data, cb)
    TriggerEvent('royal-phone:client:voiceMessage', data.seconds)
    cb(1)
end)

RegisterNUICallback('markRead', function(data, cb)
    TriggerServerEvent('royal-phone:server:markRead', data.number)
    cb(1)
end)

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

    -- The upload host and its key are server-side, so the clip goes there and
    -- comes back as a URL — or as itself, when remote storage is off or failed.
    local url = lib.callback.await('royal-phone:server:uploadVoice', false, body, data.seconds)

    cb({ url = url or body })
end)

RegisterNUICallback('voiceLimits', function(_, cb)
    cb({ maxSeconds = Config.VoiceMaxSeconds })
end)

RegisterNetEvent('royal-phone:client:newMessage', function(message)
    PhoneSend('newMessage', message)
    Notify({
        app = 'messages',
        title = message.name or message.sender,
        content = message.content,
        sound = true,
        route = { number = message.receiver and message.receiver:find('^group:') and message.receiver or message.sender },
    })
end)
