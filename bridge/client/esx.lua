if Config.Framework == 'ESX' then
    Bridge = Bridge or {}

    local ESX = exports['es_extended']:getSharedObject()

    function Bridge.IsLoaded()
        return ESX.IsPlayerLoaded()
    end

    function Bridge.GetPlayerData()
        local data = ESX.GetPlayerData()
        if not data then return nil end

        return {
            citizenid = data.identifier,
            firstname = data.firstName,
            lastname = data.lastName,
            phone = data.phoneNumber,
            job = data.job and data.job.label or nil,
            gang = nil,
        }
    end

    function Bridge.IsDead()
        return LocalPlayer.state.isDead == true or IsEntityDead(cache.ped)
    end

    function Bridge.IsCuffed()
        return LocalPlayer.state.isCuffed == true
    end

    RegisterNetEvent('esx:playerLoaded', function()
        TriggerEvent('royal-phone:client:playerLoaded')
    end)

    RegisterNetEvent('esx:onPlayerLogout', function()
        TriggerEvent('royal-phone:client:playerUnloaded')
    end)
end
