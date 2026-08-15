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

RegisterNUICallback('li:refresh', function(_, cb)
    cb(lib.callback.await('royal-phone:server:li:getData', false) or false)
end)

local refreshQueued = false

RegisterNetEvent('royal-phone:client:li:refresh', function()
    if not PhoneIsOpen() or refreshQueued then return end

    refreshQueued = true

    SetTimeout(1500, function()
        refreshQueued = false
        if not PhoneIsOpen() then return end

        local payload = lib.callback.await('royal-phone:server:li:getData', false)
        if payload then PhoneSend('lifeinvader', payload) end
    end)
end)
