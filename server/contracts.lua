--- Contracts: an additive export so OTHER resources can drop a signable
--- document onto a player's phone (used by the pawnshop employee-contract
--- feature). Reuses the phone's own Identity layer, so it is correct whether or
--- not SIM cards are enabled. Nothing here changes existing phone behaviour.
---
--- exports['royal-phone']:CreateContract(fromSrc, toSrc, {
---     title = 'Employment Contract',
---     body  = '...',
---     banner = 'slate',           -- optional
---     company = 'Downtown Pawn',  -- optional, used in the notification
--- })  ->  documentId | false, reason

exports('CreateContract', function(fromSrc, toSrc, opts)
    opts = type(opts) == 'table' and opts or {}

    if type(Identity) ~= 'table' or type(Identity.get) ~= 'function' then
        return false, 'identity_unavailable'
    end

    local from = Identity.get(tonumber(fromSrc))   -- employer (document owner + signer)
    local to = Identity.get(tonumber(toSrc))       -- employee (signer)
    if not from or not to then return false, 'phone_identity' end
    if from.owner == to.owner then return false, 'same_person' end

    local title = tostring(opts.title or 'Employment Contract'):sub(1, 64)
    local banner = tostring(opts.banner or 'slate'):sub(1, 16)
    local body = tostring(opts.body or '')
    local maxLen = (type(Config) == 'table' and Config.DocumentMaxLength) or 8000
    if #body > maxLen then body = body:sub(1, maxLen) end

    -- Signable document owned by the employer.
    local id = MySQL.insert.await(
        'INSERT INTO royal_phone_documents (identifier, title, banner, body, signable) VALUES (?, ?, ?, ?, 1)',
        { from.owner, title, banner, body }
    )
    if not id then return false, 'insert_failed' end

    -- Share it with the employee (read-only).
    MySQL.insert.await([[
        INSERT INTO royal_phone_document_shares (document, identifier, number, name, can_edit)
        VALUES (?, ?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE number = VALUES(number), name = VALUES(name)
    ]], { id, to.owner, to.number, to.name })

    -- Both parties get a pending signature row.
    MySQL.insert.await(
        'INSERT IGNORE INTO royal_phone_document_signatures (document, identifier, name, number) VALUES (?, ?, ?, ?)',
        { id, from.owner, from.name, from.number }
    )
    MySQL.insert.await(
        'INSERT IGNORE INTO royal_phone_document_signatures (document, identifier, name, number) VALUES (?, ?, ?, ?)',
        { id, to.owner, to.name, to.number }
    )

    -- Live-refresh both phones so the document shows up immediately.
    if type(Identity.refresh) == 'function' then
        pcall(Identity.refresh, tonumber(fromSrc), 'documents')
        pcall(Identity.refresh, tonumber(toSrc), 'documents')
    end

    -- Notify the employee to open + sign.
    TriggerClientEvent('royal-phone:client:notify', tonumber(toSrc), {
        app = 'documents',
        title = 'Contract to sign',
        content = ('%s sent you a contract to sign'):format(opts.company or from.name or 'Your employer'),
        sound = true,
        route = { id = id },
    })

    return id
end)
