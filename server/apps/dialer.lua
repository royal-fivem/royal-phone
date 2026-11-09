---@type table<number, { with: number, number: string, since: number }>
local activeCalls = {}

local nextChannel = 0

local function claimChannel()
    nextChannel += 1
    if nextChannel > 1000000 then nextChannel = 1 end
    return nextChannel
end

---@param receiver number source of the phone that rang
---@param callerNumber string
---@param logId number|nil row in royal_phone_calls, so the tap lands on it
local function notifyMissed(receiver, callerNumber, logId)
    local identity = Identity.get(receiver)
    if not identity or not callerNumber then return end

    local saved = MySQL.scalar.await(
        'SELECT name FROM royal_phone_contacts WHERE identifier = ? AND number = ? LIMIT 1',
        { identity.owner, callerNumber }
    )

    Identity.refresh(receiver, 'data')

    TriggerClientEvent('royal-phone:client:notify', receiver, {
        app = 'dialer',
        title = saved or callerNumber,
        content = saved and ('Missed call · %s'):format(callerNumber) or 'Missed call',
        sound = true,
        route = { tab = 'calls', id = logId, number = callerNumber },
    })
end

---@param src number
---@param reason 'hangup'|'declined'|'unavailable'|'dropped'
local function dropCall(src, reason)
    local call = activeCalls[src]
    if not call then return end

    local other = call.with
    local otherCall = other and activeCalls[other] or nil
    activeCalls[src] = nil
    if other then activeCalls[other] = nil end

    local mine = Identity.number(src)

    Phone.Emit('callEnded', {
        id = call.logId,
        callerSource = call.outgoing and src or other,
        receiverSource = call.outgoing and other or src,
        callerNumber = call.outgoing and mine or call.number,
        receiverNumber = call.outgoing and call.number or mine,
        answered = call.answeredAt ~= nil,
        duration = call.answeredAt and (os.time() - call.answeredAt) or 0,
        reason = reason,
        endedBy = src,
    })

    TriggerClientEvent('royal-phone:client:callEnded', src, { reason = reason })
    if other then
        TriggerClientEvent('royal-phone:client:callEnded', other, { reason = reason })
    end

    if call.logId and call.answeredAt then
        MySQL.update('UPDATE royal_phone_calls SET answered = 1 WHERE id = ?', { call.logId })
    end

    -- The caller gave up (or dropped) while it was still ringing: a missed call
    -- on the other end. Declining it yourself is not "missed".
    if call.outgoing and not call.answeredAt and other and otherCall and reason ~= 'declined' then
        notifyMissed(other, otherCall.number, call.logId)
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

    Phone.Emit('callStarted', {
        id = logId,
        callerSource = src,
        receiverSource = target,
        callerNumber = caller,
        receiverNumber = number,
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

    Phone.Emit('callAnswered', {
        id = call.logId,
        callerSource = other,
        receiverSource = src,
        callerNumber = call.number,
        receiverNumber = Identity.number(src),
    })
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

--- Used by server/api.lua for the GetCall / EndCall exports.
---@param src number
function PhoneGetCall(src)
    local call = activeCalls[src]
    if not call then return nil end

    return {
        id = call.logId,
        number = call.number,
        with = call.with,
        outgoing = call.outgoing == true,
        answered = call.answeredAt ~= nil,
        since = call.since,
    }
end

---@param src number
---@param reason? string
---@return boolean
function PhoneEndCall(src, reason)
    if not activeCalls[src] then return false end
    dropCall(src, reason or 'hangup')
    return true
end
