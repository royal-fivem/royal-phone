RegisterNUICallback('getNearby', function(_, cb)
    cb(lib.callback.await('royal-phone:server:getNearby', false) or {})
end)

RegisterNUICallback('shareContact', function(data, cb)
    cb(lib.callback.await('royal-phone:server:shareContact', false, data) or false)
end)

RegisterNUICallback('addContact', function(data, cb)
    local result = lib.callback.await('royal-phone:server:addContact', false, data)
    cb(result or false)
end)

RegisterNUICallback('removeContact', function(data, cb)
    local result = lib.callback.await('royal-phone:server:removeContact', false, data.id)
    cb(result or false)
end)

RegisterNetEvent('royal-phone:client:contactShared', function(data)
    Notify({
        app = 'contacts',
        title = 'Contact saved',
        content = ('%s · %s'):format(data.name or 'Unknown', data.number or ''),
        sound = true,
    })
end)
