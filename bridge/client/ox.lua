if Config.Framework == 'OX' then
    Bridge = Bridge or {}

    function Bridge.IsLoaded()
        return LocalPlayer.state.isLoggedIn == true or Ox ~= nil
    end

    function Bridge.GetPlayerData()
        local player = Ox and Ox.GetPlayer and Ox.GetPlayer()
        if not player then return nil end

        return {
            citizenid = player.stateId,
            firstname = player.firstName,
            lastname = player.lastName,
            phone = player.get and player.get('phoneNumber') or nil,
            job = player.getGroup and player.getGroup() or nil,
            gang = nil,
        }
    end

    function Bridge.IsDead()
        return LocalPlayer.state.isDead == true or IsEntityDead(cache.ped)
    end

    function Bridge.IsCuffed()
        return LocalPlayer.state.isCuffed == true
    end
end
