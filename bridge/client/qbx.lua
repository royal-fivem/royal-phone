if Config.Framework == 'QBX' then
    Bridge = Bridge or {}

    function Bridge.IsLoaded()
        local data = exports.qbx_core:GetPlayerData()
        return data ~= nil and data.citizenid ~= nil
    end

    function Bridge.GetPlayerData()
        local data = exports.qbx_core:GetPlayerData()
        if not data then return nil end

        local charinfo = data.charinfo or {}

        return {
            citizenid = data.citizenid,
            firstname = charinfo.firstname,
            lastname = charinfo.lastname,
            phone = charinfo.phone,
            job = data.job and data.job.label or nil,
            gang = data.gang and data.gang.label or nil,
        }
    end

    function Bridge.IsDead()
        if GetResourceState('qbx_medical') == 'started' then
            return exports.qbx_medical:IsDead() or exports.qbx_medical:IsLaststand()
        end
        return LocalPlayer.state.isDead == true or IsEntityDead(cache.ped)
    end

    function Bridge.IsCuffed()
        return LocalPlayer.state.isCuffed == true or LocalPlayer.state.handcuffed == true
    end

    RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
        TriggerEvent('royal-phone:client:playerLoaded')
    end)

    RegisterNetEvent('qbx_core:client:playerLoggedOut', function()
        TriggerEvent('royal-phone:client:playerUnloaded')
    end)
end
