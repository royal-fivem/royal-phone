--- Who the phone thinks you are.
---
--- With `Config.RequireSim` the phone is only hardware. The identity — number,
--- contacts, messages, documents, social accounts — belongs to the **SIM card**,
--- and the card carries a serial in its ox_inventory metadata. A blank card is
--- registered to whoever first puts it in a phone; from then on the serial is
--- what everything is keyed to.
---
--- The consequence is the point of the feature: put someone else's SIM in your
--- phone and you are reading their messages. Nothing else in the resource needs
--- to know that happened, because every query already keys off whatever this
--- module says the owner is.
---
--- With `Config.RequireSim = false` (or no ox_inventory) this degrades to the old
--- behaviour: one identity per character, keyed on the character's identifier.

Identity = Identity or {}

local function getPlayer(src)
    if type(Bridge) ~= 'table' or type(Bridge.GetPlayer) ~= 'function' then return nil end
    local ok, player = pcall(Bridge.GetPlayer, src)
    if not ok then return nil end
    return player
end

local function usingSims()
    return Config.RequireSim and Config.Inventory == 'ox_inventory'
        and GetResourceState('ox_inventory') == 'started'
end

---Resolved identities, keyed by source.
---
---Resolving one costs an inventory read and up to two queries, and some call
---sites need it for every online player (see `sourcesForOwner`). Without this,
---opening a phone with a few shared documents on a busy server was hundreds of
---queries. Short TTL rather than explicit invalidation because the only thing that
---changes it is the card moving between inventories, and being one tick late on
---that is harmless.
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

---Drop a player's cached identity. Called when they swap cards or disconnect.
---@param src number
function Identity.forget(src)
    cache[src] = nil
end

AddEventHandler('playerDropped', function()
    cache[source] = nil
end)

-- Closing an inventory is when a SIM has just been moved in or out of the phone,
-- so that player's identity may have changed. `playerId` is the source of whoever
-- had it open. The TTL is still the backstop for anything this misses.
AddEventHandler('ox_inventory:closedInventory', function(playerId)
    local src = tonumber(playerId)
    if src then cache[src] = nil end
end)

--#region serials and numbers

---Build a number from Config.NumberFormat, replacing every '#' with a digit.
local function rollNumber()
    local number = Config.NumberFormat:gsub('#', function()
        return tostring(math.random(0, 9))
    end)
    return Config.NumberPrefix .. number
end

---A number nobody else holds.
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

---A serial nobody else holds. Short enough to read off an item label.
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

--#endregion

--#region sim lookup

---The phone item's container inventory — the SIM tray.
---
---The phone item in ox_inventory is a container (`container = { slots = 1 }`),
---and the card goes *inside* it, not loose in the player's pockets. That is a
---different inventory with its own id, which is why searching the player turns up
---nothing even with a card sitting in the phone.
---
---`GetContainerFromSlot` creates the container inventory if it has never been
---opened, so this works before the player has ever looked inside the phone.
---@param src number
---@return string|nil containerId
local function phoneContainer(src)
    local ok, phone = pcall(function()
        return exports.ox_inventory:GetSlotWithItem(src, Config.ItemName)
    end)

    if not ok or not phone then return nil end

    -- No container property on the item: it is a plain phone, so the card can
    -- only be loose in the player's inventory.
    if not phone.metadata or not phone.metadata.container then return nil end

    local built, container = pcall(function()
        return exports.ox_inventory:GetContainerFromSlot(src, phone.slot)
    end)

    if not built or not container then
        -- Older items can be missing `metadata.size`, which GetContainerFromSlot
        -- needs to build the inventory. The raw id still works for a lookup.
        return phone.metadata.container
    end

    return container.id or phone.metadata.container
end

---Where the SIM card is, and which inventory it lives in.
---
---The phone's own tray first, then loose in the player's inventory — so this
---works whether or not the phone item is set up as a container.
---
---Returns a plain description rather than the slot itself: `GetSlotWithItem`
---hands back a live reference into ox_inventory's own item table, and writing a
---field onto it would end up persisted in the player's inventory data.
---@param src number
---@return { slot: number, metadata: table, inventory: string|number }|nil
local function simSlot(src)
    if not usingSims() then return nil end

    local function look(inventory)
        local ok, slot = pcall(function()
            return exports.ox_inventory:GetSlotWithItem(inventory, Config.SimItem)
        end)

        if not ok or not slot then return nil end

        return { slot = slot.slot, metadata = slot.metadata or {}, inventory = inventory }
    end

    local container = phoneContainer(src)
    if container then
        local found = look(container)
        if found then return found end
    end

    return look(src)
end

---Register a blank SIM to this character and stamp the serial into the item.
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

    -- The serial lives on the item from here on, so the card keeps its identity
    -- through drops, trades and stashes. Written to whichever inventory it was
    -- found in — the phone's tray or the player's pockets.
    --
    -- Copied rather than mutated: the metadata table came from ox_inventory's own
    -- slot data, and editing it in place would change the item before SetMetadata
    -- had a chance to validate and save it.
    local metadata = {}
    for key, value in pairs(slot.metadata or {}) do metadata[key] = value end

    metadata.serial = serial
    metadata.number = number
    metadata.registered = ('%s %s'):format(player.firstname or '', player.lastname or '')
    metadata.description = ('Number: %s'):format(number)

    local ok = pcall(function()
        exports.ox_inventory:SetMetadata(slot.inventory or src, slot.slot, metadata)
    end)

    if not ok then
        print(('^3[royal-phone]^7 could not stamp %s onto the SIM item.'):format(serial))
    end

    print(('^2[royal-phone]^7 registered %s to %s'):format(serial, player.identifier))

    return { serial = serial, identifier = serial, number = number }
end

--#endregion

--#region public

---Resolve the phone identity for a player.
---
---`owner` is the key every table in this resource uses for "whose phone is this".
---With SIMs on it is the card's serial; without them it is the character's
---identifier. Either way the rest of the server treats it as an opaque string.
---
---@param src number
---@return { owner: string, number: string, serial: string|nil, name: string, identifier: string }|nil
function Identity.get(src)
    local hit = cached(src)
    if hit then return hit end

    local player = getPlayer(src)
    if not player then return nil end

    local name = ('%s %s'):format(player.firstname or '', player.lastname or '')

    -- No SIMs: the character *is* the phone.
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

    -- Blank card: claim it.
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

    -- Serial stamped on the item but missing from the database — a wiped table, a
    -- hand-spawned item. Re-register it under the same serial rather than
    -- refusing to open, so the card keeps working.
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
        -- The player holding the card, not whoever it is registered to — this is
        -- the name that goes out on messages they send.
        name = name,
        registeredTo = row.label,
    })
end

---Just the number, for the many call sites that only need that.
---@param src number
---@return string|nil
function Identity.number(src)
    local identity = Identity.get(src)
    return identity and identity.number or nil
end

---Find who is holding the SIM that owns a number, if anyone.
---
---Cannot use the framework's phone lookup once SIMs are on, because a character's
---charinfo.phone has nothing to do with the card in their pocket.
---@param number string
---@return number|nil source
function Identity.sourceFromNumber(number)
    if not usingSims() then
        if type(Bridge) == 'table' and type(Bridge.GetSourceByPhone) == 'function' then
            local ok, src = pcall(Bridge.GetSourceByPhone, number)
            if ok and src then return src end
        end

        local identifier = MySQL.scalar.await(
            'SELECT identifier FROM royal_phone_numbers WHERE number = ? LIMIT 1', { number }
        )
        if not identifier then return nil end

        if type(Bridge) == 'table' and type(Bridge.GetSourceByIdentifier) == 'function' then
            local ok, src = pcall(Bridge.GetSourceByIdentifier, identifier)
            if ok then return src end
        end

        return nil
    end

    local serial = MySQL.scalar.await(
        'SELECT serial FROM royal_phone_sims WHERE number = ? LIMIT 1', { number }
    )
    if not serial then return nil end

    -- Whoever is currently carrying that card. Walking every online player is the
    -- only way to answer this, but it goes through Identity.get so the 5 s cache
    -- absorbs it — a text to a group of ten would otherwise re-read every online
    -- player's phone container ten times over.
    for _, id in ipairs(GetPlayers()) do
        local other = tonumber(id)

        if other then
            local identity = Identity.get(other)
            if identity and identity.serial == serial then return other end
        end
    end

    return nil
end

---Tell a player's open phone that one slice of its data changed, so it re-pulls
---instead of waiting to be closed and reopened.
---@param src number
---@param slice 'data'|'documents'|'lifeinvader'
function Identity.refresh(src, slice)
    if not src then return end
    TriggerClientEvent('royal-phone:client:refresh', src, slice or 'data')
end

---Same, addressed by owner key rather than source.
---@param owner string
---@param slice 'data'|'documents'|'lifeinvader'
function Identity.refreshOwner(owner, slice)
    for _, src in ipairs(Identity.sourcesForOwner(owner)) do
        Identity.refresh(src, slice)
    end
end

---Everyone online whose phone identity is this owner key. Used to push live
---updates — with SIMs there is exactly one holder, but the shape stays the same.
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

--#endregion
