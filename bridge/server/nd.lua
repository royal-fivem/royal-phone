if Config.Framework == 'ND' then
    Bridge = Bridge or {}

    function Bridge.GetPlayer(src)
        local character = exports['ND_Core']:getPlayer(src)
        if not character then return nil end

        return {
            identifier = tostring(character.id),
            firstname = character.firstName,
            lastname = character.lastName,
            phone = character.metadata and character.metadata.phoneNumber or nil,
            job = character.jobLabel,
            gang = nil,
            cash = character.cash or 0,
            bank = character.bank or 0,
        }
    end

    function Bridge.GetSourceByIdentifier(identifier)
        for src, character in pairs(exports['ND_Core']:getPlayers()) do
            if tostring(character.id) == identifier then return src end
        end
        return nil
    end

    function Bridge.GetSourceByPhone(number)
        for src, character in pairs(exports['ND_Core']:getPlayers()) do
            local metadata = character.metadata
            if metadata and metadata.phoneNumber == number then return src end
        end
        return nil
    end

    ---@return boolean
    function Bridge.MoveMoney(src, account, amount, reason)
        local character = exports['ND_Core']:getPlayer(src)
        if not character then return false end

        if amount < 0 and (character[account] or 0) < -amount then return false end

        character.addMoney(account, amount, reason)
        return true
    end

    ---@param identifier string character id
    ---@return table[]
    function Bridge.GetVehicles(_, identifier)
        local rows = MySQL.query.await('SELECT * FROM nd_vehicles WHERE owner = ?', { tonumber(identifier) or identifier })
            or {}
        local out = {}

        for _, row in ipairs(rows) do
            local props = json.decode(row.properties or row.metadata or '{}') or {}

            out[#out + 1] = {
                id = row.id,
                model = row.model or props.model,
                plate = row.plate,
                vin = row.vin,
                garage = row.garage,
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
