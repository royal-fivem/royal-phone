exports('CreateContract', function(fromSrc, toSrc, opts)
    opts = type(opts) == 'table' and opts or {}

    if type(Identity) ~= 'table' or type(Identity.get) ~= 'function' then
        return false, 'identity_unavailable'
    end

    local from = Identity.get(tonumber(fromSrc))
    local to = Identity.get(tonumber(toSrc))
    if not from or not to then return false, 'phone_identity' end
    if from.owner == to.owner then return false, 'same_person' end

    local title = tostring(opts.title or 'Employment Contract'):sub(1, 64)
    local banner = tostring(opts.banner or 'slate'):sub(1, 16)
    local body = tostring(opts.body or '')
    local maxLen = (type(Config) == 'table' and Config.DocumentMaxLength) or 8000
    if #body > maxLen then body = body:sub(1, maxLen) end

    local id = MySQL.insert.await(
        'INSERT INTO royal_phone_documents (identifier, title, banner, body, signable) VALUES (?, ?, ?, ?, 1)',
        { from.owner, title, banner, body }
    )
    if not id then return false, 'insert_failed' end

    MySQL.insert.await([[
        INSERT INTO royal_phone_document_shares (document, identifier, number, name, can_edit)
        VALUES (?, ?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE number = VALUES(number), name = VALUES(name)
    ]], { id, to.owner, to.number, to.name })

    MySQL.insert.await(
        'INSERT IGNORE INTO royal_phone_document_signatures (document, identifier, name, number) VALUES (?, ?, ?, ?)',
        { id, from.owner, from.name, from.number }
    )
    MySQL.insert.await(
        'INSERT IGNORE INTO royal_phone_document_signatures (document, identifier, name, number) VALUES (?, ?, ?, ?)',
        { id, to.owner, to.name, to.number }
    )

    Identity.refresh(tonumber(fromSrc), 'documents')
    Identity.refresh(tonumber(toSrc), 'documents')

    TriggerClientEvent('royal-phone:client:notify', tonumber(toSrc), {
        app = 'documents',
        title = 'Contract to sign',
        content = ('%s sent you a contract to sign'):format(opts.company or from.name or 'Your employer'),
        sound = true,
        route = { id = id },
    })

    return id
end)
