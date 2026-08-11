if Config.Framework == 'ND' then
    Bridge = Bridge or {}

    function Bridge.IsLoaded()
        local character = exports['ND_Core']:getPlayer()
        return character ~= nil
    end

    function Bridge.GetPlayerData()
        local character = exports['ND_Core']:getPlayer()
        if not character then return nil end

        return {
            citizenid = tostring(character.id),
            firstname = character.firstName,
            lastname = character.lastName,
            phone = character.metadata and character.metadata.phoneNumber or nil,
            job = character.jobLabel,
            gang = nil,
        }
    end

    function Bridge.IsDead()
        return LocalPlayer.state.isDead == true or IsEntityDead(cache.ped)
    end

    function Bridge.IsCuffed()
        return LocalPlayer.state.isCuffed == true
    end

    RegisterNetEvent('ND:characterLoaded', function()
        TriggerEvent('royal-phone:client:playerLoaded')
    end)

    RegisterNetEvent('ND:characterUnloaded', function()
        TriggerEvent('royal-phone:client:playerUnloaded')
    end)
end
