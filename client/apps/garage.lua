local ModelNames

---@param model string|number|nil
---@return number|nil hash, string|nil spawnName
local function resolveModel(model)
    if not model or model == '' then return nil, nil end

    if type(model) == 'string' and not tonumber(model) then
        return joaat(model) & 0xFFFFFFFF, model:lower()
    end

    if not ModelNames then
        ModelNames = {}
        for _, name in ipairs(GetAllVehicleModels()) do
            ModelNames[joaat(name) & 0xFFFFFFFF] = name:lower()
        end
    end

    local key = tonumber(model) & 0xFFFFFFFF
    return key, ModelNames[key]
end

RegisterNUICallback('garage:vehicles', function(_, cb)
    local rows = lib.callback.await('royal-phone:server:garage:vehicles', false) or {}
    local vehicles = {}

    for _, row in ipairs(rows) do
        local hash, spawnName = resolveModel(row.spawnName)
        local name = hash and GetLabelText(GetDisplayNameFromVehicleModel(hash)) or nil

        if not name or name == '' or name == 'NULL' then
            name = spawnName or row.spawnName or 'Vehicle'
        end

        vehicles[#vehicles + 1] = {
            id = row.id,
            name = name,
            spawnName = spawnName or row.spawnName,
            location = row.stored and (row.garageLabel or 'Unknown garage') or 'Out of the garage',
            stored = row.stored,
            plate = row.plate,
            vin = row.vin,
            engine = row.engine,
            fuel = row.fuel,
            body = row.body,
            mileage = row.mileage,
        }
    end

    cb(vehicles)
end)

RegisterNUICallback('garage:track', function(data, cb)
    local rows = lib.callback.await('royal-phone:server:garage:vehicles', false) or {}

    local target
    for _, row in ipairs(rows) do
        if row.id == data.id then target = row break end
    end

    if not target then
        Notify({ app = 'garage', title = 'Track vehicle', content = 'That vehicle is no longer yours.' })
        return cb({ error = 'not_found' })
    end

    if target.stored then
        Notify({ app = 'garage', title = 'Track vehicle', content = ('Parked at %s.'):format(target.garageLabel or 'an unknown garage') })
        return cb({ ok = true })
    end

    local coords = lib.callback.await('royal-phone:server:garage:locate', false, target.id)
    if coords then
        SetNewWaypoint(coords.x + 0.0, coords.y + 0.0)
        Notify({ app = 'garage', title = 'Track vehicle', content = 'Waypoint set to your vehicle.' })
        return cb({ ok = true })
    end

    Notify({ app = 'garage', title = 'Track vehicle', content = 'Could not get a fix on that vehicle.' })
    cb({ error = 'no_signal' })
end)
