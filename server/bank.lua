Phone = Phone or {}
Phone.Bank = {}

---@return boolean
local function usePhoneLedger()
    if type(Bridge.HasBank) == 'function' then return Bridge.HasBank() ~= true end

    return Bridge.HasBank ~= true
end

---@param identifier string
---@return number
local function ledgerBalance(identifier)
    local balance = MySQL.scalar.await(
        'SELECT balance FROM royal_phone_bank_accounts WHERE identifier = ? LIMIT 1', { identifier }
    )

    if balance == nil then
        balance = 0

        MySQL.insert.await(
            'INSERT IGNORE INTO royal_phone_bank_accounts (identifier) VALUES (?)', { identifier }
        )
    end

    return math.floor(tonumber(balance) or 0)
end

---@param identifier string
---@param amount number negative to take
---@return boolean
local function ledgerMove(identifier, amount)
    ledgerBalance(identifier)

    -- guarded in the WHERE clause so concurrent transfers cannot both spend the
    -- same balance
    local affected = MySQL.update.await([[
        UPDATE royal_phone_bank_accounts
        SET balance = balance + ?
        WHERE identifier = ? AND balance + ? >= 0
    ]], { amount, identifier, amount })

    return (affected or 0) > 0
end

---@param src number
---@param account 'cash'|'bank'
---@return number
function Phone.Bank.Balance(src, account)
    if account == 'bank' and usePhoneLedger() then
        local player = Bridge.GetPlayer(src)
        return player and ledgerBalance(player.identifier) or 0
    end

    if type(Bridge.GetBalance) == 'function' then
        return math.floor(tonumber(Bridge.GetBalance(src, account)) or 0)
    end

    local player = Bridge.GetPlayer(src)
    if not player then return 0 end

    return math.floor(tonumber(account == 'cash' and player.cash or player.bank) or 0)
end

---@param src number
---@return { cash: number, bank: number }
function Phone.Bank.Balances(src)
    return {
        cash = Phone.Bank.Balance(src, 'cash'),
        bank = Phone.Bank.Balance(src, 'bank'),
    }
end

---Negative takes, positive gives. Refuses to overdraw on every framework.
---@param src number
---@param account 'cash'|'bank'
---@param amount number
---@param reason string
---@return boolean
function Phone.Bank.Move(src, account, amount, reason)
    amount = math.floor(tonumber(amount) or 0)
    if amount == 0 then return true end

    if account == 'bank' and usePhoneLedger() then
        local player = Bridge.GetPlayer(src)
        if not player then return false end

        return ledgerMove(player.identifier, amount)
    end

    if type(Bridge.MoveMoney) ~= 'function' then return false end

    return Bridge.MoveMoney(src, account, amount, reason) == true
end

---Parks the amount in royal_phone_bank_pending, claimed on their next phone open.
---@param identifier string character identifier
---@param amount number positive
---@param label string
function Phone.Bank.CreditOffline(identifier, amount, label)
    amount = math.floor(tonumber(amount) or 0)
    if amount <= 0 then return end

    if usePhoneLedger() then
        ledgerMove(identifier, amount)
        return
    end

    MySQL.insert.await(
        'INSERT INTO royal_phone_bank_pending (identifier, amount, label) VALUES (?, ?, ?)',
        { identifier, amount, tostring(label):sub(1, 64) }
    )
end

---@param src number
---@param identifier string character identifier
function Phone.Bank.ClaimPending(src, identifier)
    local rows = MySQL.query.await(
        'SELECT id, amount FROM royal_phone_bank_pending WHERE identifier = ?', { identifier }
    ) or {}

    if #rows == 0 then return end

    for _, row in ipairs(rows) do
        if Phone.Bank.Move(src, 'bank', row.amount, 'royal-phone transfer') then
            MySQL.update.await('DELETE FROM royal_phone_bank_pending WHERE id = ?', { row.id })
        end
    end
end

---Resolves a number to the character account behind it. With SIMs on,
---royal_phone_numbers is keyed by serial, so the holder wins and the registered
---owner is the fallback.
---@param number string
---@return { src: number|nil, identifier: string, name: string|nil }|nil
function Phone.Bank.Resolve(number)
    if not number or number == '' then return nil end

    local src = Identity.sourceFromNumber(number)

    if src then
        local player = Bridge.GetPlayer(src)

        if player then
            return {
                src = src,
                identifier = player.identifier,
                name = ('%s %s'):format(player.firstname or '', player.lastname or ''),
            }
        end
    end

    local row = MySQL.single.await([[
        SELECT n.identifier AS owner, s.identifier AS character_id, s.label
        FROM royal_phone_numbers n
        LEFT JOIN royal_phone_sims s ON s.serial = n.sim
        WHERE n.number = ? LIMIT 1
    ]], { number })

    if not row then return nil end

    local identifier = row.character_id or row.owner
    if not identifier then return nil end

    return { src = nil, identifier = identifier, name = row.label }
end

---Keyed on the character, never the SIM serial: a debt follows the person.
---@param identifier string character identifier
---@return table[]
function Phone.Bank.Invoices(identifier)
    if not Config.BankInvoices then return {} end

    return MySQL.query.await([[
        SELECT id, label, sender, amount, paid, declined,
               can_decline AS canDecline,
               UNIX_TIMESTAMP(created_at) * 1000 AS createdAt,
               UNIX_TIMESTAMP(paid_at) * 1000 AS paidAt,
               UNIX_TIMESTAMP(declined_at) * 1000 AS declinedAt
        FROM royal_phone_bank_invoices
        WHERE identifier = ?
        ORDER BY (paid = 0 AND declined = 0) DESC, created_at DESC
        LIMIT 100
    ]], { identifier }) or {}
end
