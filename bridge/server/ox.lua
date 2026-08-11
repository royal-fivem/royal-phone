if Config.Framework == 'OX' then
    Bridge = Bridge or {}

    function Bridge.GetPlayer(src)
        local player = Ox and Ox.GetPlayer and Ox.GetPlayer(src)
        if not player then return nil end

        return {
            identifier = player.stateId,
            firstname = player.firstName,
            lastname = player.lastName,
            phone = player.get('phoneNumber'),
            job = player.getGroup and player.getGroup() or nil,
            gang = nil,
            cash = exports.ox_inventory:GetItemCount(src, 'money') or 0,
            bank = 0,
        }
    end

    function Bridge.GetSourceByIdentifier(identifier)
        local player = Ox and Ox.GetPlayerByFilter and Ox.GetPlayerByFilter({ stateId = identifier })
        return player and player.source or nil
    end

    function Bridge.GetSourceByPhone(number)
        for _, player in pairs(Ox.GetPlayers()) do
            if player.get('phoneNumber') == number then
                return player.source
            end
        end
        return nil
    end

    ---ox_core keeps cash as an inventory item and has no bank of its own, so only
    ---cash moves here. Point this at your banking resource for transfers.
    ---@return boolean
    function Bridge.MoveMoney(src, account, amount, _)
        if account ~= 'cash' then return false end

        if amount < 0 then
            return exports.ox_inventory:RemoveItem(src, 'money', -amount) == true
        end

        return exports.ox_inventory:AddItem(src, 'money', amount) == true
    end
end
