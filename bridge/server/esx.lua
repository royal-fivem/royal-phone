if Config.Framework == 'ESX' then
    Bridge = Bridge or {}

    local ESX = exports['es_extended']:getSharedObject()

    function Bridge.GetPlayer(src)
        local player = ESX.GetPlayerFromId(src)
        if not player then return nil end

        return {
            identifier = player.identifier,
            firstname = player.get('firstName'),
            lastname = player.get('lastName'),
            phone = player.get('phoneNumber'),
            job = player.job and player.job.label or nil,
            gang = nil,
            cash = player.getAccount('money') and player.getAccount('money').money or 0,
            bank = player.getAccount('bank') and player.getAccount('bank').money or 0,
        }
    end

    function Bridge.GetSourceByIdentifier(identifier)
        local player = ESX.GetPlayerFromIdentifier(identifier)
        return player and player.source or nil
    end

    function Bridge.GetSourceByPhone(number)
        for _, player in pairs(ESX.GetExtendedPlayers()) do
            if player.get('phoneNumber') == number then
                return player.source
            end
        end
        return nil
    end

    ---Move money. `account` is 'cash' or 'bank'; a negative amount takes it away.
    ---Returns false when the player cannot cover a withdrawal.
    ---@return boolean
    function Bridge.MoveMoney(src, account, amount, reason)
        local player = ESX.GetPlayerFromId(src)
        if not player then return false end

        local name = account == 'cash' and 'money' or 'bank'

        if amount < 0 then
            local held = player.getAccount(name)
            if not held or held.money < -amount then return false end

            player.removeAccountMoney(name, -amount, reason)
            return true
        end

        player.addAccountMoney(name, amount, reason)
        return true
    end
end
