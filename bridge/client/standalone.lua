if Config.Framework == 'STANDALONE' then
    Bridge = Bridge or {}

    function Bridge.IsLoaded()
        return true
    end

    function Bridge.GetPlayerData()
        return {
            citizenid = tostring(GetPlayerServerId(PlayerId())),
            firstname = GetPlayerName(PlayerId()),
            lastname = '',
            phone = nil,
            job = nil,
            gang = nil,
        }
    end

    function Bridge.IsDead()
        return IsEntityDead(cache.ped)
    end

    function Bridge.IsCuffed()
        return false
    end
end
