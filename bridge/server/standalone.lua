if Config.Framework == 'STANDALONE' then
    Bridge = Bridge or {}

    function Bridge.GetPlayer(src)
        return {
            identifier = GetPlayerIdentifierByType(src, 'license') or tostring(src),
            firstname = GetPlayerName(src),
            lastname = '',
            phone = nil,
            job = nil,
            gang = nil,
            cash = 0,
            bank = 0,
        }
    end

    function Bridge.GetSourceByIdentifier(identifier)
        for _, src in ipairs(GetPlayers()) do
            if GetPlayerIdentifierByType(src, 'license') == identifier then
                return tonumber(src)
            end
        end
        return nil
    end

    function Bridge.GetSourceByPhone(_)
        return nil
    end

    -- no accounts to talk to: the Bank app runs on royal_phone_bank_accounts
    Bridge.HasBank = false

    ---@return number
    function Bridge.GetBalance()
        return 0
    end

    ---@return boolean
    function Bridge.MoveMoney()
        return false
    end

    ---@return table[]
    function Bridge.GetVehicles()
        return {}
    end
end
