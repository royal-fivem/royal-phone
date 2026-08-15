---@param value any
---@return number 0-100
local function toPct(value)
    local number = tonumber(value)
    if not number then return 100 end

    if number <= 1 then return math.floor(number * 100 + 0.5) end
    if number > 100 then return math.floor((number / 1000) * 100 + 0.5) end

    return math.floor(number + 0.5)
end

local function trim(value)
    return (tostring(value or ''):gsub('^%s*(.-)%s*$', '%1'))
end

local function prettify(key)
    if not key or key == '' then return nil end

    return (tostring(key):gsub('[_%-]+', ' '):gsub('(%a[%w]*)', function(word)
        return word:sub(1, 1):upper() .. word:sub(2)
    end))
end

lib.callback.register('royal-phone:server:garage:vehicles', function(src)
    local player = Bridge.GetPlayer(src)
    if not player or not player.identifier then return {} end

    local rows = Bridge.GetVehicles(src, player.identifier)

    local vehicles = {}

    for _, row in ipairs(rows) do
        vehicles[#vehicles + 1] = {
            id = row.id,
            spawnName = row.model,
            plate = trim(row.plate),
            vin = row.vin,
            garage = row.garage,
            garageLabel = prettify(row.garage),
            stored = row.stored,
            fuel = toPct(row.fuel),
            engine = toPct(row.engine),
            body = toPct(row.body),
            mileage = row.mileage or 0,
        }
    end

    return vehicles
end)

---@param src number
---@param id string|number vehicle row id, checked against the caller's own rows
---@return table|nil { x, y, z }
lib.callback.register('royal-phone:server:garage:locate', function(src, id)
    local player = Bridge.GetPlayer(src)
    if not player or not player.identifier then return nil end

    local owned
    for _, row in ipairs(Bridge.GetVehicles(src, player.identifier)) do
        if row.id == id then
            owned = row
            break
        end
    end

    if not owned then return nil end

    local plate = trim(owned.plate):upper()

    for _, entity in ipairs(GetAllVehicles()) do
        local state = Entity(entity).state
        local match = state and (state.vehicleid == owned.id or state.vehicleId == owned.id)

        if not match and plate ~= '' then
            match = trim(GetVehicleNumberPlateText(entity)):upper() == plate
        end

        if match then
            local coords = GetEntityCoords(entity)
            return { x = coords.x, y = coords.y, z = coords.z }
        end
    end

    return nil
end)
