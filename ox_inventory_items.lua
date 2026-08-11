--[[
    Items for ox_inventory.
    ─────────────────────────────────────────────────────────────────────────────
    Copy these into ox_inventory/data/items.lua.

    They are NOT loaded from here — ox_inventory only reads its own data files.
    This file exists so you have the exact definitions to paste, nothing more.

    HOW THE SIM GOES IN
    The phone item is a *container* with one slot: that slot is the SIM tray.
    Open the phone in your inventory and drop the card in. The resource reads the
    phone's container first and only then falls back to a card loose in your
    pockets, so either arrangement works — but the tray is the intended one.

    The whitelist is what stops players stuffing anything else in the phone.
    Without it the single slot will happily hold a burger.

    Item names must match config.lua: Config.ItemName and Config.SimItem.
]]

['phone'] = {
    label = 'Phone',
    weight = 190,
    stack = false,
    -- Containers must not be consumed on use.
    consume = 0,
    description = 'Useless without a SIM card.',
    container = {
        label = 'Phone',
        slots = 1,
        maxWeight = 2000,
        -- Only a SIM fits in the tray.
        whitelist = { 'simcard' },
    },
    buttons = {
        {
            label = 'Open SIM tray',
            action = function(slot)
                exports.ox_inventory:openInventory('container', slot)
            end,
        },
    },
},

['simcard'] = {
    label = 'SIM Card',
    weight = 10,
    -- Never stack: each card carries its own identity in metadata, and stacking
    -- would merge two different phone numbers into one slot.
    stack = false,
    close = false,
    description = 'A blank card registers itself to the first phone it goes in.',
},
