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

    Bridge.HasBank = true

    ---@param src number
    ---@param account 'cash'|'bank'
    ---@return number
    function Bridge.GetBalance(src, account)
        local player = ESX.GetPlayerFromId(src)
        if not player then return 0 end

        local held = player.getAccount(account == 'cash' and 'money' or 'bank')
        return math.floor(tonumber(held and held.money) or 0)
    end

    ---@param src number
    ---@param account 'cash'|'bank'
    ---@param amount number negative to take
    ---@param reason string
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

    ---@param identifier string license identifier
    ---@return table[]
    function Bridge.GetVehicles(_, identifier)
        local rows = MySQL.query.await('SELECT * FROM owned_vehicles WHERE owner = ?', { identifier }) or {}
        local out = {}

        for _, row in ipairs(rows) do
            local props = json.decode(row.vehicle or '{}') or {}

            out[#out + 1] = {
                id = row.plate,
                model = props.model,
                plate = row.plate,
                vin = row.vin,
                garage = row.garage or row.parking,
                stored = row.stored == 1 or row.stored == true,
                fuel = props.fuelLevel,
                engine = props.engineHealth,
                body = props.bodyHealth,
                mileage = tonumber(row.mileage),
            }
        end

        return out
    end
end
