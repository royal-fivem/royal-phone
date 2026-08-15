---@type table<number, { with: number, number: string, since: number }>
local activeCalls = {}

local nextChannel = 0

local function claimChannel()
    nextChannel += 1
    if nextChannel > 1000000 then nextChannel = 1 end
    return nextChannel
end

---@param src number
---@param reason 'hangup'|'declined'|'unavailable'|'dropped'
local function dropCall(src, reason)
    local call = activeCalls[src]
    if not call then return end

    local other = call.with
    activeCalls[src] = nil
    if other then activeCalls[other] = nil end

    TriggerClientEvent('royal-phone:client:callEnded', src, { reason = reason })
    if other then
        TriggerClientEvent('royal-phone:client:callEnded', other, { reason = reason })
    end

    if call.logId and call.answeredAt then
        MySQL.update('UPDATE royal_phone_calls SET answered = 1 WHERE id = ?', { call.logId })
    end
end

RegisterNetEvent('royal-phone:server:call', function(number)
    local src = source
    if type(number) ~= 'string' then return end

    local caller = Identity.number(src)
    if not caller or caller == number then return end

    if activeCalls[src] then return end

    local target = Identity.sourceFromNumber(number)

    local logId = MySQL.insert.await(
        'INSERT INTO royal_phone_calls (caller, receiver, answered) VALUES (?, ?, 0)',
        { caller, number }
    )

    if not target or activeCalls[target] then
        TriggerClientEvent('royal-phone:client:callEnded', src, { reason = 'unavailable' })
        return
    end

    local callerPlayer = Bridge.GetPlayer(src)
    local callerName = callerPlayer
        and ('%s %s'):format(callerPlayer.firstname or '', callerPlayer.lastname or '')
        or caller

    local channel = claimChannel()

    activeCalls[src] = {
        with = target, number = number, since = os.time(),
        channel = channel, logId = logId, outgoing = true,
    }
    activeCalls[target] = {
        with = src, number = caller, since = os.time(),
        channel = channel, logId = logId, outgoing = false,
    }

    TriggerClientEvent('royal-phone:client:incomingCall', target, {
        number = caller,
        name = callerName,
    })
end)

RegisterNetEvent('royal-phone:server:answerCall', function()
    local src = source
    local call = activeCalls[src]
    if not call or call.answeredAt then return end

    local other = call.with
    if not other or not activeCalls[other] then
        dropCall(src, 'unavailable')
        return
    end

    local now = os.time()
    call.answeredAt = now
    activeCalls[other].answeredAt = now

    MySQL.update('UPDATE royal_phone_calls SET answered = 1 WHERE id = ?', { call.logId })

    TriggerClientEvent('royal-phone:client:callConnected', src, { channel = call.channel })
    TriggerClientEvent('royal-phone:client:callConnected', other, { channel = call.channel })
end)

RegisterNetEvent('royal-phone:server:declineCall', function()
    dropCall(source, 'declined')
end)

RegisterNetEvent('royal-phone:server:endCall', function()
    dropCall(source, 'hangup')
end)

AddEventHandler('playerDropped', function()
    dropCall(source, 'dropped')
end)
