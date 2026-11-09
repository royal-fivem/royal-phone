lib.callback.register('royal-phone:server:addContact', function(src, data)
    local identity = Identity.get(src)
    if not identity or type(data) ~= 'table' then return false end

    local name = tostring(data.name or ''):sub(1, 48)
    local number = tostring(data.number or ''):sub(1, 24)
    if name == '' or number == '' then return false end

    local avatar = CleanAvatar(data.avatar)

    if data.id then
        MySQL.update.await(
            'UPDATE royal_phone_contacts SET name = ?, number = ?, avatar = ? WHERE id = ? AND identifier = ?',
            { name, number, avatar, data.id, identity.owner }
        )
        return { id = data.id }
    end

    local id = MySQL.insert.await(
        'INSERT INTO royal_phone_contacts (identifier, name, number, avatar) VALUES (?, ?, ?, ?)',
        { identity.owner, name, number, avatar }
    )

    Phone.Emit('contactAdded', { owner = identity.owner, number = identity.number, source = src },
        { id = id, name = name, number = number })

    return { id = id }
end)

lib.callback.register('royal-phone:server:removeContact', function(src, id)
    local identity = Identity.get(src)
    if not identity or not id then return false end

    MySQL.update.await(
        'DELETE FROM royal_phone_contacts WHERE id = ? AND identifier = ?',
        { id, identity.owner }
    )

    return true
end)

lib.callback.register('royal-phone:server:shareContact', function(src, data)
    local identity = Identity.get(src)
    if not identity or type(data) ~= 'table' then return false end

    local target = tonumber(data.target)
    if not target or target == src then return false end

    local origin = GetEntityCoords(GetPlayerPed(src))
    local coords = GetEntityCoords(GetPlayerPed(target))
    if #(origin - coords) > (Config.NearbyRange or 12.0) then return { error = 'too_far' } end

    local targetIdentity = Identity.get(target)
    if not targetIdentity then return { error = 'no_phone' } end

    sweepOffers()

    local name, number

    if data.id then
        local row = MySQL.single.await(
            'SELECT name, number FROM royal_phone_contacts WHERE id = ? AND identifier = ?',
            { data.id, identity.owner }
        )
        if not row then return false end

        name, number = row.name, row.number
    else
        name, number = identity.name, identity.number
    end

    if not number then return false end

    local existing = MySQL.scalar.await(
        'SELECT 1 FROM royal_phone_contacts WHERE identifier = ? AND number = ? LIMIT 1',
        { targetIdentity.owner, number }
    )
    if existing then return { already = true, name = name } end

    local token = newOffer({
        kind = 'contact',
        to = target,
        from = src,
        name = name,
        number = number,
        sender = identity.name,
    })

    TriggerClientEvent('royal-phone:client:notify', target, {
        app = 'dialer',
        title = 'Contact offered',
        content = ('%s wants to share %s (%s)'):format(identity.name, name, number),
        sound = true,
        duration = 0,
        offer = {
            kind = 'contact',
            token = token,
            acceptLabel = 'Save',
            acceptedText = ('Saved %s'):format(name),
        },
    })

    return { offered = true, name = name }
end)

PhoneOfferHandlers['contact'] = function(src, identity, offer)
    local existing = MySQL.scalar.await(
        'SELECT 1 FROM royal_phone_contacts WHERE identifier = ? AND number = ? LIMIT 1',
        { identity.owner, offer.number }
    )

    if not existing then
        MySQL.insert.await(
            'INSERT INTO royal_phone_contacts (identifier, name, number) VALUES (?, ?, ?)',
            { identity.owner, offer.name, offer.number }
        )
    end

    Identity.refresh(src, 'data')

    if offer.from then
        TriggerClientEvent('royal-phone:client:notify', offer.from, {
            app = 'dialer',
            title = 'Contact shared',
            content = ('They saved %s.'):format(offer.name),
        })
    end
end
