Identity = Identity or {}

local function usingSims()
    return Config.RequireSim and Config.Inventory == 'ox_inventory'
        and GetResourceState('ox_inventory') == 'started'
end

local CACHE_TTL = 5000
local cache = {}

local function cached(src)
    local hit = cache[src]
    if hit and GetGameTimer() - hit.at < CACHE_TTL then return hit.identity end
    return nil
end

local function remember(src, identity)
    cache[src] = { identity = identity, at = GetGameTimer() }
    return identity
end

---@param src number
function Identity.forget(src)
    cache[src] = nil
end

AddEventHandler('playerDropped', function()
    cache[source] = nil
end)

AddEventHandler('ox_inventory:closedInventory', function(playerId)
    local src = tonumber(playerId)
    if src then cache[src] = nil end
end)

local function rollNumber()
    local number = Config.NumberFormat:gsub('#', function()
        return tostring(math.random(0, 9))
    end)
    return Config.NumberPrefix .. number
end

local function freeNumber()
    local number
    repeat
        number = rollNumber()
        local taken = MySQL.scalar.await(
            'SELECT 1 FROM royal_phone_numbers WHERE number = ? LIMIT 1', { number }
        )
    until not taken
    return number
end

local function freeSerial()
    local serial
    repeat
        serial = ('%s-%04d-%04d'):format(Config.SimPrefix, math.random(0, 9999), math.random(0, 9999))
        local taken = MySQL.scalar.await(
            'SELECT 1 FROM royal_phone_sims WHERE serial = ? LIMIT 1', { serial }
        )
    until not taken
    return serial
end

---@param src number
---@return string|nil containerId
local function phoneContainer(src)
    local phone = exports.ox_inventory:GetSlotWithItem(src, Config.ItemName)
    if not phone then return nil end

    if not phone.metadata or not phone.metadata.container then return nil end

    local container = exports.ox_inventory:GetContainerFromSlot(src, phone.slot)
    if not container then return phone.metadata.container end

    return container.id or phone.metadata.container
end

---@param src number
---@return { slot: number, metadata: table, inventory: string|number }|nil
local function simSlot(src)
    if not usingSims() then return nil end

    local function look(inventory)
        local slot = exports.ox_inventory:GetSlotWithItem(inventory, Config.SimItem)
        if not slot then return nil end

        return { slot = slot.slot, metadata = slot.metadata or {}, inventory = inventory }
    end

    local container = phoneContainer(src)
    if container then
        local found = look(container)
        if found then return found end
    end

    return look(src)
end

---@param src number
---@param slot table from simSlot, carrying the inventory it was found in
---@param player table
---@return table|nil row from royal_phone_sims
local function registerSim(src, slot, player)
    local serial = freeSerial()
    local number = freeNumber()

    MySQL.insert.await(
        'INSERT INTO royal_phone_sims (serial, identifier, number, label) VALUES (?, ?, ?, ?)',
        { serial, player.identifier, number, ('%s %s'):format(player.firstname or '', player.lastname or '') }
    )

    MySQL.insert.await([[
        INSERT INTO royal_phone_numbers (identifier, number, sim) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE number = VALUES(number), sim = VALUES(sim)
    ]], { serial, number, serial })

    local metadata = {}
    for key, value in pairs(slot.metadata or {}) do metadata[key] = value end

    metadata.serial = serial
    metadata.number = number
    metadata.registered = ('%s %s'):format(player.firstname or '', player.lastname or '')
    metadata.description = ('Number: %s'):format(number)

    exports.ox_inventory:SetMetadata(slot.inventory or src, slot.slot, metadata)

    print(('^2[royal-phone]^7 registered %s to %s'):format(serial, player.identifier))

    return { serial = serial, identifier = serial, number = number }
end

---@param src number
---@return { owner: string, number: string, serial: string|nil, name: string, identifier: string }|nil
function Identity.get(src)
    local hit = cached(src)
    if hit then return hit end

    local player = Bridge.GetPlayer(src)
    if not player then return nil end

    local name = ('%s %s'):format(player.firstname or '', player.lastname or '')

    if not usingSims() then
        local number = player.phone

        if not number or number == '' then
            number = MySQL.scalar.await(
                'SELECT number FROM royal_phone_numbers WHERE identifier = ? LIMIT 1', { player.identifier }
            )
        end

        if not number then
            number = freeNumber()
            MySQL.insert.await([[
                INSERT INTO royal_phone_numbers (identifier, number) VALUES (?, ?)
                ON DUPLICATE KEY UPDATE number = VALUES(number)
            ]], { player.identifier, number })
        end

        return remember(src, {
            owner = player.identifier,
            identifier = player.identifier,
            number = number,
            serial = nil,
            name = name,
        })
    end

    local slot = simSlot(src)
    if not slot then return nil end

    local serial = slot.metadata and slot.metadata.serial
    if not serial then
        local created = registerSim(src, slot, player)
        if not created then return nil end

        return remember(src, {
            owner = created.serial,
            identifier = created.serial,
            number = created.number,
            serial = created.serial,
            name = name,
        })
    end

    local row = MySQL.single.await(
        'SELECT serial, number, label FROM royal_phone_sims WHERE serial = ? LIMIT 1', { serial }
    )
    if not row then
        local number = freeNumber()

        MySQL.insert.await(
            'INSERT INTO royal_phone_sims (serial, identifier, number, label) VALUES (?, ?, ?, ?)',
            { serial, player.identifier, number, name }
        )
        MySQL.insert.await([[
            INSERT INTO royal_phone_numbers (identifier, number, sim) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE number = VALUES(number), sim = VALUES(sim)
        ]], { serial, number, serial })

        row = { serial = serial, number = number, label = name }
    end

    return remember(src, {
        owner = row.serial,
        identifier = row.serial,
        number = row.number,
        serial = row.serial,
        name = name,
        registeredTo = row.label,
    })
end

---@param src number
---@return string|nil
function Identity.number(src)
    local identity = Identity.get(src)
    return identity and identity.number or nil
end

---@param number string
---@return number|nil source
function Identity.sourceFromNumber(number)
    if not usingSims() then
        if type(Bridge.GetSourceByPhone) == 'function' then
            local src = Bridge.GetSourceByPhone(number)
            if src then return src end
        end

        local identifier = MySQL.scalar.await(
            'SELECT identifier FROM royal_phone_numbers WHERE number = ? LIMIT 1', { number }
        )
        if not identifier then return nil end

        if type(Bridge.GetSourceByIdentifier) == 'function' then
            return Bridge.GetSourceByIdentifier(identifier)
        end

        return nil
    end

    local serial = MySQL.scalar.await(
        'SELECT serial FROM royal_phone_sims WHERE number = ? LIMIT 1', { number }
    )
    if not serial then return nil end

    for _, id in ipairs(GetPlayers()) do
        local other = tonumber(id)

        if other then
            local identity = Identity.get(other)
            if identity and identity.serial == serial then return other end
        end
    end

    return nil
end

---@param src number
---@param slice 'data'|'documents'|'lifeinvader'
function Identity.refresh(src, slice)
    if not src then return end
    TriggerClientEvent('royal-phone:client:refresh', src, slice or 'data')
end

---@param owner string
---@param slice 'data'|'documents'|'lifeinvader'
function Identity.refreshOwner(owner, slice)
    for _, src in ipairs(Identity.sourcesForOwner(owner)) do
        Identity.refresh(src, slice)
    end
end

---@param owner string
---@return number[]
function Identity.sourcesForOwner(owner)
    local found = {}

    for _, id in ipairs(GetPlayers()) do
        local other = tonumber(id)
        if other then
            local identity = Identity.get(other)
            if identity and identity.owner == owner then found[#found + 1] = other end
        end
    end

    return found
end

