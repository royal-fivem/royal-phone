if Config.Framework == 'QBX' then
    Bridge = Bridge or {}

    ---@param src number
    ---@return table|nil { identifier, firstname, lastname, phone, job, gang, cash, bank }
    function Bridge.GetPlayer(src)
        local player = exports.qbx_core:GetPlayer(src)
        if not player then return nil end

        local charinfo = player.PlayerData.charinfo or {}
        local money = player.PlayerData.money or {}

        return {
            identifier = player.PlayerData.citizenid,
            firstname = charinfo.firstname,
            lastname = charinfo.lastname,
            phone = charinfo.phone,
            job = player.PlayerData.job and player.PlayerData.job.label or nil,
            gang = player.PlayerData.gang and player.PlayerData.gang.label or nil,
            cash = money.cash or 0,
            bank = money.bank or 0,
        }
    end

    ---@param identifier string citizenid
    ---@return number|nil source
    function Bridge.GetSourceByIdentifier(identifier)
        local player = exports.qbx_core:GetPlayerByCitizenId(identifier)
        return player and player.PlayerData.source or nil
    end

    ---@param number string
    ---@return number|nil source
    function Bridge.GetSourceByPhone(number)
        local players = exports.qbx_core:GetQBPlayers()
        for _, player in pairs(players) do
            local charinfo = player.PlayerData.charinfo
            if charinfo and charinfo.phone == number then
                return player.PlayerData.source
            end
        end
        return nil
    end

    ---@param src number
    ---@param account 'cash'|'bank'
    ---@param amount number
    ---@param reason string
    ---@return boolean
    function Bridge.MoveMoney(src, account, amount, reason)
        local player = exports.qbx_core:GetPlayer(src)
        if not player then return false end

        if amount < 0 then
            return player.Functions.RemoveMoney(account, -amount, reason) == true
        end

        return player.Functions.AddMoney(account, amount, reason) == true
    end

    ---@param identifier string citizenid
    ---@return table[]
    function Bridge.GetVehicles(_, identifier)
        local rows = MySQL.query.await('SELECT * FROM player_vehicles WHERE citizenid = ?', { identifier }) or {}
        local out = {}

        for _, row in ipairs(rows) do
            local props = json.decode(row.mods or '{}') or {}

            out[#out + 1] = {
                id = row.id,
                model = row.vehicle or props.model,
                plate = props.plate or row.plate,
                vin = row.vin,
                garage = row.garage,
                stored = tonumber(row.state) == 1,
                fuel = props.fuelLevel or row.fuel,
                engine = props.engineHealth or row.engine,
                body = props.bodyHealth or row.body,
                mileage = tonumber(row.drivingdistance or row.mileage),
            }
        end

        return out
    end
end
