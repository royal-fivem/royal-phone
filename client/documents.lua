RegisterNUICallback('docs:save', function(data, cb)
    cb(lib.callback.await('royal-phone:server:docs:save', false, data) or false)
end)

RegisterNUICallback('docs:delete', function(data, cb)
    lib.callback.await('royal-phone:server:docs:delete', false, data.id)
    cb(1)
end)

RegisterNUICallback('docs:invite', function(data, cb)
    cb(lib.callback.await('royal-phone:server:docs:invite', false, data) or false)
end)

RegisterNUICallback('docs:uninvite', function(data, cb)
    lib.callback.await('royal-phone:server:docs:uninvite', false, data)
    cb(1)
end)

RegisterNUICallback('docs:requestSignatures', function(data, cb)
    cb(lib.callback.await('royal-phone:server:docs:requestSignatures', false, data) or false)
end)

RegisterNUICallback('docs:sign', function(data, cb)
    cb(lib.callback.await('royal-phone:server:docs:sign', false, data) or false)
end)
