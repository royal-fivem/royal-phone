if Config.Framework == 'OX' then
    Bridge = Bridge or {}

    -- cash is the ox_inventory 'money' item; a bank exists only if the accounts
    -- module is running, otherwise the phone ledger takes over
    local probed

    -- probed on first use: ox_core may not have started when this file is parsed
    function Bridge.HasBank()
        if probed == nil then
            if GetResourceState('ox_core') ~= 'started' then return false end

            probed = type(exports.ox_core.GetCharacterAccount) == 'function'
        end

        return probed
    end

    ---@param src number
    ---@return table|nil OxAccount
    local function accountOf(src)
        if not Bridge.HasBank() then return nil end

        return exports.ox_core:GetCharacterAccount(src)
    end

    ---@param account table
    ---@param method 'addBalance'|'removeBalance'
    ---@param amount number positive
    ---@param message string
    ---@return boolean
    local function moveBalance(account, method, amount, message)
        local fn = account[method]
        if type(fn) ~= 'function' then return false end

        return fn(account, amount, message) ~= false
    end

    ---@param src number
    ---@return table|nil OxPlayer
    local function oxPlayer(src)
        if not Ox or not Ox.GetPlayer then return nil end
        return Ox.GetPlayer(src)
    end

    function Bridge.GetPlayer(src)
        local player = oxPlayer(src)
        if not player then return nil end

        return {
            identifier = player.stateId,
            firstname = player.firstName,
            lastname = player.lastName,
            phone = player.get('phoneNumber'),
            job = player.getGroup and player.getGroup() or nil,
            gang = nil,
            cash = exports.ox_inventory:GetItemCount(src, 'money') or 0,
            bank = Bridge.GetBalance(src, 'bank'),
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

    ---@param src number
    ---@param account 'cash'|'bank'
    ---@return number
    function Bridge.GetBalance(src, account)
        if account == 'cash' then
            return math.floor(tonumber(exports.ox_inventory:GetItemCount(src, 'money')) or 0)
        end

        local held = accountOf(src)
        if not held then return 0 end

        local balance = held.get and held.get('balance') or held.balance
        return math.floor(tonumber(balance) or 0)
    end

    ---@param src number
    ---@param account 'cash'|'bank'
    ---@param amount number negative to take
    ---@param reason string
    ---@return boolean
    function Bridge.MoveMoney(src, account, amount, reason)
        if account == 'cash' then
            if amount < 0 then
                return exports.ox_inventory:RemoveItem(src, 'money', -amount) == true
            end

            return exports.ox_inventory:AddItem(src, 'money', amount) == true
        end

        local held = accountOf(src)
        if not held then return false end

        if amount < 0 then
            if Bridge.GetBalance(src, 'bank') < -amount then return false end

            return moveBalance(held, 'removeBalance', -amount, reason)
        end

        return moveBalance(held, 'addBalance', amount, reason)
    end

    ---vehicles.owner is the numeric charId, not the stateId Bridge.GetPlayer
    ---returns as its identifier.
    ---@param src number
    ---@param identifier? string stateId, as the other bridges are called with
    ---@return table[]
    function Bridge.GetVehicles(src, identifier)
        local player = oxPlayer(src)
        local charId = player and player.charId

        local rows

        if charId then
            rows = MySQL.query.await('SELECT * FROM vehicles WHERE owner = ?', { charId })
        elseif identifier then
            rows = MySQL.query.await([[
                SELECT v.* FROM vehicles v
                JOIN characters c ON c.charId = v.owner
                WHERE c.stateId = ?
            ]], { identifier })
        end

        rows = rows or {}
        local out = {}

        for _, row in ipairs(rows) do
            local props = json.decode(row.data or '{}') or {}

            out[#out + 1] = {
                id = row.id,
                model = row.model or props.model,
                plate = row.plate,
                vin = row.vin,
                garage = row.stored,
                stored = row.stored ~= nil and row.stored ~= '',
                fuel = props.fuelLevel,
                engine = props.engineHealth,
                body = props.bodyHealth,
                mileage = tonumber(row.mileage),
            }
        end

        return out
    end
end
