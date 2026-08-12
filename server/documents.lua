---@param value any
---@return boolean
local function isTrue(value)
    return value == true or value == 1 or value == '1'
end

local function getPlayer(src)
    if type(Bridge) ~= 'table' or type(Bridge.GetPlayer) ~= 'function' then return nil end
    local ok, player = pcall(Bridge.GetPlayer, src)
    if not ok then return nil end
    return player
end

local function displayName(player)
    if not player then return 'Unknown' end
    return (('%s %s'):format(player.firstname or '', player.lastname or '')):gsub('^%s*(.-)%s*$', '%1')
end

---Access level a character has on a document.
---@return 'owner'|'edit'|'read'|nil
local function accessTo(identifier, id)
    local owner = MySQL.scalar.await('SELECT identifier FROM royal_phone_documents WHERE id = ? LIMIT 1', { id })
    if not owner then return nil end
    if owner == identifier then return 'owner' end

    local share = MySQL.single.await(
        'SELECT can_edit FROM royal_phone_document_shares WHERE document = ? AND identifier = ? LIMIT 1',
        { id, identifier }
    )
    if not share then return nil end

    return isTrue(share.can_edit) and 'edit' or 'read'
end

local function ownerName(owner)
    local stored = MySQL.scalar.await(
        "SELECT name FROM royal_phone_document_shares WHERE identifier = ? AND name <> '' LIMIT 1", { owner }
    )
    if stored then return stored end

    for _, src in ipairs(Identity.sourcesForOwner(owner)) do
        local name = displayName(getPlayer(src))
        if name ~= '' and name ~= 'Unknown' then return name end
    end

    return 'Unknown'
end

local function documentsFor(identifier)
    local rows = MySQL.query.await([[
        SELECT d.id, d.identifier, d.title, d.banner, d.body, d.signable,
               UNIX_TIMESTAMP(d.updated_at) * 1000 AS updatedAt,
               s.can_edit AS sharedCanEdit
        FROM royal_phone_documents d
        LEFT JOIN royal_phone_document_shares s ON s.document = d.id AND s.identifier = ?
        WHERE d.identifier = ? OR s.identifier IS NOT NULL
        ORDER BY d.updated_at DESC
        LIMIT 200
    ]], { identifier, identifier }) or {}

    if #rows == 0 then return {} end

    local ids = {}
    for _, row in ipairs(rows) do ids[#ids + 1] = row.id end

    local placeholders = string.rep('?,', #ids):sub(1, -2)
    local shareRows = MySQL.query.await(
        ('SELECT document, number, name, can_edit FROM royal_phone_document_shares WHERE document IN (%s)'):format(placeholders),
        ids
    ) or {}

    local byDocument = {}
    for _, row in ipairs(shareRows) do
        byDocument[row.document] = byDocument[row.document] or {}
        table.insert(byDocument[row.document], {
            number = row.number,
            name = row.name ~= '' and row.name or row.number,
            canEdit = isTrue(row.can_edit),
        })
    end

    local signatureRows = MySQL.query.await(
        ([[
            SELECT document, identifier, name, number, UNIX_TIMESTAMP(signed_at) * 1000 AS signedAt
            FROM royal_phone_document_signatures WHERE document IN (%s)
        ]]):format(placeholders),
        ids
    ) or {}

    local signaturesFor = {}
    for _, row in ipairs(signatureRows) do
        signaturesFor[row.document] = signaturesFor[row.document] or {}
        table.insert(signaturesFor[row.document], {
            identifier = row.identifier,
            name = row.name ~= '' and row.name or row.number,
            number = row.number,
            signedAt = row.signedAt,
            signed = row.signedAt ~= nil,
        })
    end

    local documents = {}
    for _, row in ipairs(rows) do
        local mine = row.identifier == identifier
        local signatures = signaturesFor[row.id] or {}

        local pending = 0
        for _, signature in ipairs(signatures) do
            if not signature.signed then pending += 1 end
        end

        local sealed = isTrue(row.signable) and #signatures > 0 and pending == 0

        local mySignature
        for _, signature in ipairs(signatures) do
            if signature.identifier == identifier then mySignature = signature end
        end

        documents[#documents + 1] = {
            id = row.id,
            title = row.title,
            banner = row.banner,
            body = row.body,
            updatedAt = row.updatedAt,
            mine = mine,
            canEdit = (mine or isTrue(row.sharedCanEdit)) and not sealed,
            owner = mine and 'You' or ownerName(row.identifier),
            shares = mine and (byDocument[row.id] or {}) or {},
            signable = isTrue(row.signable),
            signatures = signatures,
            sealed = sealed,
            canSign = isTrue(row.signable) and mySignature ~= nil and not mySignature.signed,
        }
    end

    return documents
end

lib.callback.register('royal-phone:server:docs:getData', function(src)
    local identity = Identity.get(src)
    if not identity then return nil end

    return { documents = documentsFor(identity.owner) }
end)

local function refreshParties(id, except)
    local owner = MySQL.scalar.await('SELECT identifier FROM royal_phone_documents WHERE id = ? LIMIT 1', { id })
    if not owner then return end

    local parties = { owner }

    local shares = MySQL.query.await(
        'SELECT identifier FROM royal_phone_document_shares WHERE document = ?', { id }
    ) or {}

    for _, share in ipairs(shares) do
        parties[#parties + 1] = share.identifier
    end

    for _, party in ipairs(parties) do
        for _, target in ipairs(Identity.sourcesForOwner(party)) do
            if target ~= except then Identity.refresh(target, 'documents') end
        end
    end
end

lib.callback.register('royal-phone:server:docs:save', function(src, data)
    local identity = Identity.get(src)
    if not identity or type(data) ~= 'table' then return false end

    local title = tostring(data.title or ''):sub(1, 64)
    local banner = tostring(data.banner or 'slate'):sub(1, 16)
    local body = tostring(data.body or '')

    if title == '' then title = 'Untitled document' end
    if #body > Config.DocumentMaxLength then body = body:sub(1, Config.DocumentMaxLength) end

    if not data.id or tonumber(data.id) == nil or tonumber(data.id) < 1 then
        local id = MySQL.insert.await(
            'INSERT INTO royal_phone_documents (identifier, title, banner, body) VALUES (?, ?, ?, ?)',
            { identity.owner, title, banner, body }
        )

        return { id = id }
    end

    local id = tonumber(data.id)
    local access = accessTo(identity.owner, id)
    if access ~= 'owner' and access ~= 'edit' then return false end

    MySQL.update.await(
        'UPDATE royal_phone_documents SET title = ?, banner = ?, body = ? WHERE id = ?',
        { title, banner, body, id }
    )

    if data.notify then refreshParties(id, src) end

    return { id = id }
end)

lib.callback.register('royal-phone:server:docs:delete', function(src, id)
    local identity = Identity.get(src)
    if not identity or not id then return false end

    local removed = MySQL.update.await(
        'DELETE FROM royal_phone_documents WHERE id = ? AND identifier = ?', { id, identity.owner }
    )

    if removed and removed > 0 then
        MySQL.update.await('DELETE FROM royal_phone_document_shares WHERE document = ?', { id })
        return true
    end

    MySQL.update.await(
        'DELETE FROM royal_phone_document_shares WHERE document = ? AND identifier = ?',
        { id, identity.owner }
    )

    return true
end)

local function mayShareWith(src, ownerKey, _, number)
    local known = MySQL.scalar.await(
        'SELECT 1 FROM royal_phone_contacts WHERE identifier = ? AND number = ? LIMIT 1',
        { ownerKey, number }
    )
    if known then return true end

    local target = Identity.sourceFromNumber(number)
    if not target then return false end

    local origin = GetEntityCoords(GetPlayerPed(src))
    local coords = GetEntityCoords(GetPlayerPed(target))

    return #(origin - coords) <= (Config.NearbyRange or 12.0)
end

lib.callback.register('royal-phone:server:docs:invite', function(src, data)
    local identity = Identity.get(src)
    if not identity or type(data) ~= 'table' then return false end

    local id = tonumber(data.id)
    local number = tostring(data.number or ''):sub(1, 24)
    if not id or number == '' then return false end

    if accessTo(identity.owner, id) ~= 'owner' then return false end

    local identifier = MySQL.scalar.await(
        'SELECT identifier FROM royal_phone_numbers WHERE number = ? LIMIT 1', { number }
    )
    if not identifier or identifier == identity.owner then return false end

    if not mayShareWith(src, identity.owner, identifier, number) then
        return { error = 'not_allowed' }
    end

    local name = number
    local targetSrc = Identity.sourceFromNumber(number)

    if targetSrc then
        local other = getPlayer(targetSrc)
        if other then name = displayName(other) end
    end

    if name == number then
        local contact = MySQL.scalar.await(
            'SELECT name FROM royal_phone_contacts WHERE identifier = ? AND number = ? LIMIT 1',
            { identity.owner, number }
        )
        if contact then name = contact end
    end

    local canEdit = data.canEdit ~= false
    local title = MySQL.scalar.await('SELECT title FROM royal_phone_documents WHERE id = ? LIMIT 1', { id })

    if not targetSrc then
        MySQL.insert.await([[
            INSERT INTO royal_phone_document_shares (document, identifier, number, name, can_edit)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE number = VALUES(number), name = VALUES(name), can_edit = VALUES(can_edit)
        ]], { id, identifier, number, name, canEdit and 1 or 0 })

        return { number = number, name = name, canEdit = canEdit, pending = false }
    end

    PhoneOffer({
        kind = 'document',
        to = targetSrc,
        from = src,
        document = id,
        name = title or 'a document',
        recipientName = name,
        canEdit = canEdit,
    }, {
        app = 'documents',
        title = 'Document shared',
        content = ('%s invited you to "%s"'):format(identity.name, title or 'a document'),
        route = { id = id },
        offer = { acceptLabel = 'Open', acceptedText = ('Joined "%s"'):format(title or 'the document') },
    })

    return { number = number, name = name, canEdit = canEdit, pending = true }
end)

lib.callback.register('royal-phone:server:docs:requestSignatures', function(src, data)
    local identity = Identity.get(src)
    if not identity or type(data) ~= 'table' then return false end

    local id = tonumber(data.id)
    if not id or accessTo(identity.owner, id) ~= 'owner' then return false end

    if data.signable == false then
        MySQL.update.await('UPDATE royal_phone_documents SET signable = 0 WHERE id = ?', { id })
        MySQL.update.await('DELETE FROM royal_phone_document_signatures WHERE document = ?', { id })

        Identity.refresh(src, 'documents')
        return { ok = true, signable = false }
    end

    local shares = MySQL.query.await(
        'SELECT identifier, number, name FROM royal_phone_document_shares WHERE document = ?', { id }
    ) or {}

    if #shares == 0 then return { error = 'Invite someone to sign it first.' } end

    MySQL.update.await('UPDATE royal_phone_documents SET signable = 1 WHERE id = ?', { id })

    MySQL.insert.await([[
        INSERT IGNORE INTO royal_phone_document_signatures (document, identifier, name, number)
        VALUES (?, ?, ?, ?)
    ]], { id, identity.owner, identity.name, identity.number })

    local title = MySQL.scalar.await('SELECT title FROM royal_phone_documents WHERE id = ? LIMIT 1', { id })

    for _, share in ipairs(shares) do
        MySQL.insert.await([[
            INSERT IGNORE INTO royal_phone_document_signatures (document, identifier, name, number)
            VALUES (?, ?, ?, ?)
        ]], { id, share.identifier, share.name, share.number })

        local target = Identity.sourcesForOwner(share.identifier)[1]

        if target then
            Identity.refresh(target, 'documents')

            TriggerClientEvent('royal-phone:client:notify', target, {
                app = 'documents',
                title = 'Signature requested',
                content = ('%s needs you to sign "%s"'):format(identity.name, title or 'a document'),
                sound = true,
                route = { id = id },
            })
        end
    end

    Identity.refresh(src, 'documents')

    return { ok = true, signable = true }
end)

lib.callback.register('royal-phone:server:docs:sign', function(src, data)
    local identity = Identity.get(src)
    if not identity or type(data) ~= 'table' then return false end

    local id = tonumber(data.id)
    if not id then return false end

    if not accessTo(identity.owner, id) then return { error = 'You are not on this document.' } end

    local row = MySQL.single.await(
        'SELECT signed_at FROM royal_phone_document_signatures WHERE document = ? AND identifier = ? LIMIT 1',
        { id, identity.owner }
    )

    if not row then return { error = 'You are not a party to this.' } end
    if row.signed_at then return { error = 'You have already signed.' } end

    MySQL.update.await([[
        UPDATE royal_phone_document_signatures
        SET signed_at = CURRENT_TIMESTAMP, name = ?, number = ?
        WHERE document = ? AND identifier = ?
    ]], { identity.name, identity.number, id, identity.owner })

    local outstanding = MySQL.scalar.await(
        'SELECT COUNT(*) FROM royal_phone_document_signatures WHERE document = ? AND signed_at IS NULL',
        { id }
    ) or 0

    local title = MySQL.scalar.await('SELECT title FROM royal_phone_documents WHERE id = ? LIMIT 1', { id })

    local parties = MySQL.query.await(
        'SELECT identifier FROM royal_phone_document_signatures WHERE document = ?', { id }
    ) or {}

    for _, party in ipairs(parties) do
        for _, target in ipairs(Identity.sourcesForOwner(party.identifier)) do
            Identity.refresh(target, 'documents')

            if outstanding == 0 and target ~= src then
                TriggerClientEvent('royal-phone:client:notify', target, {
                    app = 'documents',
                    title = 'Fully signed',
                    content = ('"%s" has been signed by everyone.'):format(title or 'A document'),
                    sound = true,
                    route = { id = id },
                })
            end
        end
    end

    return { ok = true, outstanding = outstanding }
end)

lib.callback.register('royal-phone:server:docs:uninvite', function(src, data)
    local identity = Identity.get(src)
    if not identity or type(data) ~= 'table' then return false end

    local id = tonumber(data.id)
    if not id or accessTo(identity.owner, id) ~= 'owner' then return false end

    MySQL.update.await(
        'DELETE FROM royal_phone_document_shares WHERE document = ? AND number = ?',
        { id, tostring(data.number or '') }
    )

    return true
end)
