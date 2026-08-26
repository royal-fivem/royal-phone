---@param amount any
---@return number|nil
local function cleanAmount(amount)
    amount = math.floor(tonumber(amount) or 0)
    if amount <= 0 then return nil end

    local cap = math.floor(tonumber(Config.BankMaxTransfer) or 0)
    if cap > 0 and amount > cap then return nil end

    return amount
end

---@param src number
---@return table { ok = true, cash, bank }
local function balances(src)
    local out = Phone.Bank.Balances(src)
    out.ok = true
    return out
end

lib.callback.register('royal-phone:server:bank:transfer', function(src, data)
    local player = Bridge.GetPlayer(src)
    if not player or type(data) ~= 'table' then return false end

    local amount = cleanAmount(data.amount)

    if not amount then
        local cap = math.floor(tonumber(Config.BankMaxTransfer) or 0)

        if cap > 0 then
            return { error = ('Enter an amount up to $%d.'):format(cap) }
        end

        return { error = 'Enter an amount.' }
    end

    local number = tostring(data.number or '')
    local mine = Identity.number(src)
    if number == '' or number == mine then return { error = 'Pick someone else.' } end

    local target = Phone.Bank.Resolve(number)
    if not target then return { error = 'No account on that number.' } end
    if target.identifier == player.identifier then return { error = 'Pick someone else.' } end

    if not Phone.Bank.Move(src, 'bank', -amount, 'royal-phone transfer') then
        return { error = 'Not enough in the bank.' }
    end

    local senderName = ('%s %s'):format(player.firstname or '', player.lastname or '')

    local paid = target.src and Phone.Bank.Move(target.src, 'bank', amount, 'royal-phone transfer')

    if not paid then
        Phone.Bank.CreditOffline(target.identifier, amount, ('Transfer from %s'):format(senderName))
    end

    Phone.LogTransaction(player.identifier, ('Transfer to %s'):format(number), -amount)
    Phone.LogTransaction(target.identifier, ('Transfer from %s'):format(senderName), amount)

    if target.src then
        TriggerClientEvent('royal-phone:client:notify', target.src, {
            app = 'bank',
            title = 'Transfer received',
            content = ('%s sent you $%s'):format(senderName, amount),
            sound = true,
        })

        Identity.refresh(target.src, 'data')
    end

    return balances(src)
end)

---@return string|nil error, nil on success
---@param src number
---@param identifier string character identifier, for the transaction line
---@param invoice table row from royal_phone_bank_invoices
local function settle(src, identifier, invoice)
    if not Phone.Bank.Move(src, 'bank', -invoice.amount, 'royal-phone invoice') then
        return 'Not enough in the bank.'
    end

    local affected = MySQL.update.await([[
        UPDATE royal_phone_bank_invoices
        SET paid = 1, paid_at = NOW(), declined = 0, declined_at = NULL
        WHERE id = ? AND paid = 0
    ]], { invoice.id })

    if (affected or 0) == 0 then
        Phone.Bank.Move(src, 'bank', invoice.amount, 'royal-phone reversal')
        return 'That invoice is already paid.'
    end

    Phone.LogTransaction(
        identifier,
        ('Invoice #%d · %s'):format(invoice.id, invoice.label),
        -invoice.amount
    )

    return nil
end

---Declined rows are still owed, so only `paid` closes one.
---@param id number
---@param identifier string character identifier
---@return table|nil row
local function unpaidInvoice(id, identifier)
    return MySQL.single.await([[
        SELECT id, label, amount, can_decline AS canDecline
        FROM royal_phone_bank_invoices
        WHERE id = ? AND identifier = ? AND paid = 0 LIMIT 1
    ]], { id, identifier })
end

lib.callback.register('royal-phone:server:bank:payInvoice', function(src, data)
    if not Config.BankInvoices then return { error = 'Invoices are off.' } end

    local player = Bridge.GetPlayer(src)
    if not player or type(data) ~= 'table' then return false end

    local id = tonumber(data.id)
    if not id then return { error = 'No such invoice.' } end

    local invoice = unpaidInvoice(id, player.identifier)
    if not invoice then return { error = 'No such invoice.' } end

    local failure = settle(src, player.identifier, invoice)
    if failure then return { error = failure } end

    local out = balances(src)
    out.invoices = Phone.Bank.Invoices(player.identifier)

    return out
end)

lib.callback.register('royal-phone:server:bank:declineInvoice', function(src, data)
    if not Config.BankInvoices then return { error = 'Invoices are off.' } end

    local player = Bridge.GetPlayer(src)
    if not player or type(data) ~= 'table' then return false end

    local id = tonumber(data.id)
    if not id then return { error = 'No such invoice.' } end

    local invoice = unpaidInvoice(id, player.identifier)
    if not invoice then return { error = 'No such invoice.' } end

    if invoice.canDecline == 0 then return { error = 'This one has to be paid.' } end

    MySQL.update.await([[
        UPDATE royal_phone_bank_invoices
        SET declined = 1, declined_at = NOW()
        WHERE id = ? AND paid = 0
    ]], { invoice.id })

    local out = balances(src)
    out.invoices = Phone.Bank.Invoices(player.identifier)

    return out
end)

lib.callback.register('royal-phone:server:bank:refresh', function(src)
    local player = Bridge.GetPlayer(src)
    if not player then return false end

    Phone.Bank.ClaimPending(src, player.identifier)

    local out = balances(src)

    out.transactions = MySQL.query.await([[
        SELECT id, label, amount, UNIX_TIMESTAMP(created_at) * 1000 AS createdAt
        FROM royal_phone_bank_transactions
        WHERE identifier = ?
        ORDER BY created_at DESC
        LIMIT 50
    ]], { player.identifier }) or {}

    out.invoices = Phone.Bank.Invoices(player.identifier)

    return out
end)

---Invoice a player. Arrives as a notification they can pay or decline, and is
---kept on the character's record either way.
---@param src number
---@param label string what the invoice is for
---@param amount number positive — what they owe
---@param sender? string who is charging, shown under the label
---@param options? table { canDecline?: boolean } false = must be paid
---@return number|false invoiceId
exports('AddInvoice', function(src, label, amount, sender, options)
    if not Config.BankInvoices then return false end

    local player = Bridge.GetPlayer(src)
    if not player then return false end

    amount = math.floor(tonumber(amount) or 0)
    if amount <= 0 then return false end

    label = tostring(label):sub(1, 64)
    sender = tostring(sender or ''):sub(1, 64)

    local canDecline = not (type(options) == 'table' and options.canDecline == false)

    local id = MySQL.insert.await([[
        INSERT INTO royal_phone_bank_invoices (identifier, label, sender, amount, can_decline)
        VALUES (?, ?, ?, ?, ?)
    ]], { player.identifier, label, sender, amount, canDecline and 1 or 0 })

    if not id then return false end

    TriggerClientEvent('royal-phone:client:notify', src, {
        app = 'bank',
        title = ('Invoice #%d'):format(id),
        content = ('%s · $%s%s'):format(label, amount, sender ~= '' and (' from ' .. sender) or ''),
        duration = 0,
        sound = true,
        route = { tab = 'invoices' },
        offer = { kind = 'invoice', invoice = id, acceptLabel = 'Pay', canDecline = canDecline },
    })

    Identity.refresh(src, 'data')

    return id
end)