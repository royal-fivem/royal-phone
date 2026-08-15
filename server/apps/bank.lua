lib.callback.register('royal-phone:server:bank:transfer', function(src, data)
    local player = Bridge.GetPlayer(src)
    if not player or type(data) ~= 'table' then return false end

    local amount = math.floor(tonumber(data.amount) or 0)
    if amount <= 0 then return { error = 'Enter an amount.' } end

    local number = tostring(data.number or '')
    local mine = Identity.number(src)
    if number == '' or number == mine then return { error = 'Pick someone else.' } end

    local targetIdentifier = MySQL.scalar.await(
        'SELECT identifier FROM royal_phone_numbers WHERE number = ? LIMIT 1', { number }
    )
    if not targetIdentifier then return { error = 'No account on that number.' } end

    if type(Bridge.MoveMoney) ~= 'function' then return { error = 'Transfers are not set up.' } end

    if not Bridge.MoveMoney(src, 'bank', -amount, 'royal-phone transfer') then
        return { error = 'Not enough in the bank.' }
    end

    local senderName = ('%s %s'):format(player.firstname or '', player.lastname or '')
    local targetSrc = Bridge.GetSourceByIdentifier and Bridge.GetSourceByIdentifier(targetIdentifier) or nil

    if targetSrc then
        Bridge.MoveMoney(targetSrc, 'bank', amount, 'royal-phone transfer')
    else
        MySQL.insert.await(
            'INSERT INTO royal_phone_bank_pending (identifier, amount, label) VALUES (?, ?, ?)',
            { targetIdentifier, amount, ('Transfer from %s'):format(senderName) }
        )
    end

    Phone.LogTransaction(player.identifier, ('Transfer to %s'):format(number), -amount)
    Phone.LogTransaction(targetIdentifier, ('Transfer from %s'):format(senderName), amount)

    if targetSrc then
        TriggerClientEvent('royal-phone:client:notify', targetSrc, {
            app = 'bank',
            title = 'Transfer received',
            content = ('%s sent you $%s'):format(senderName, amount),
            sound = true,
        })
    end

    return { ok = true }
end)
