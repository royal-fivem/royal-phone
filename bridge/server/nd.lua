if Config.Framework == 'ND' then
    Bridge = Bridge or {}

    ---@param character table ND character
    ---@param account 'cash'|'bank'
    ---@return number
    local function balanceOf(character, account)
        if type(character.getMoney) == 'function' then
            return math.floor(tonumber(character.getMoney(account)) or 0)
        end

        return math.floor(tonumber(character[account]) or 0)
    end

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
            cash = balanceOf(character, 'cash'),
            bank = balanceOf(character, 'bank'),
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

    Bridge.HasBank = true

    ---@param src number
    ---@param account 'cash'|'bank'
    ---@return number
    function Bridge.GetBalance(src, account)
        local character = exports['ND_Core']:getPlayer(src)
        if not character then return 0 end

        return balanceOf(character, account)
    end

    ---@param src number
    ---@param account 'cash'|'bank'
    ---@param amount number negative to take
    ---@param reason string
    ---@return boolean
    function Bridge.MoveMoney(src, account, amount, reason)
        local character = exports['ND_Core']:getPlayer(src)
        if not character then return false end

        if amount < 0 then
            if balanceOf(character, account) < -amount then return false end

            -- addMoney rejects negatives rather than subtracting
            if type(character.deductMoney) == 'function' then
                return character.deductMoney(account, -amount, reason) ~= false
            end

            return false
        end

        return character.addMoney(account, amount, reason) ~= false
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
