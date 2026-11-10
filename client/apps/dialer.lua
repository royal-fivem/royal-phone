---@type table|nil { number, name, state, channel }
local currentCall = nil

---@return boolean
function PhoneCallActive()
    return currentCall ~= nil and currentCall.state ~= 'incoming'
end

---@param channel number
local function setVoiceChannel(channel)
    if Config.Voice ~= 'pma-voice' then return end
    if GetResourceState('pma-voice') ~= 'started' then return end

    exports['pma-voice']:setCallChannel(channel)
end

RegisterNUICallback('callMode', function(_, cb)
    if not PhoneIsOpen() then
        SetNuiFocus(false, false)
        SetNuiFocusKeepInput(false)
    end

    cb(1)
end)

RegisterNUICallback('call', function(data, cb)
    currentCall = { number = data.number, name = data.name or data.number, state = 'dialing' }
    PhoneRefreshAnimation()
    TriggerServerEvent('royal-phone:server:call', data.number)
    TriggerEvent('royal-phone:outgoingCall', { number = data.number, name = currentCall.name })
    cb(1)
end)

RegisterNUICallback('answerCall', function(_, cb)
    if currentCall then currentCall.state = 'active' end
    PhoneRefreshAnimation()
    TriggerServerEvent('royal-phone:server:answerCall')
    cb(1)
end)

RegisterNUICallback('declineCall', function(_, cb)
    TriggerServerEvent('royal-phone:server:declineCall')
    cb(1)
end)

RegisterNUICallback('endCall', function(_, cb)
    TriggerServerEvent('royal-phone:server:endCall')
    cb(1)
end)

RegisterNUICallback('setMuted', function(data, cb)
    local muted = data and data.muted == true

    if currentCall and currentCall.channel then
        setVoiceChannel(muted and 0 or currentCall.channel)
    end

    cb(1)
end)

RegisterNetEvent('royal-phone:client:incomingCall', function(call)
    currentCall = { number = call.number, name = call.name, state = 'incoming' }

    PhoneSend('incomingCall', {
        number = call.number,
        name = call.name,
        answerKey = Config.AnswerKey,
        declineKey = Config.DeclineKey,
    })

    TriggerEvent('royal-phone:incomingCall', { number = call.number, name = call.name })
end)

RegisterNetEvent('royal-phone:client:callConnected', function(data)
    if not currentCall then return end

    currentCall.state = 'active'
    currentCall.channel = data and data.channel or nil

    if currentCall.channel then setVoiceChannel(currentCall.channel) end

    PhoneSend('callConnected', { channel = currentCall.channel })
    TriggerEvent('royal-phone:callAnswered', { number = currentCall.number, name = currentCall.name })
end)

RegisterNetEvent('royal-phone:client:callEnded', function(data)
    local reason = data and data.reason or 'hangup'
    local wasDialing = currentCall and currentCall.state == 'dialing'
    local ended = currentCall

    currentCall = nil
    setVoiceChannel(0)
    PhoneRefreshAnimation()

    PhoneSend('callEnded', { reason = reason })

    if ended then
        TriggerEvent('royal-phone:callEnded', { number = ended.number, name = ended.name, reason = reason })
    end

    if wasDialing then
        if reason == 'unavailable' then
            Notify({ app = 'dialer', title = 'Unavailable', content = 'They could not be reached.' })
        elseif reason == 'declined' then
            Notify({ app = 'dialer', title = 'Call declined', content = 'They turned down the call.' })
        end
    end
end)

RegisterCommand('royalphone_answer', function()
    if not currentCall then return end

    if currentCall.state == 'incoming' then
        currentCall.state = 'active'
        PhoneRefreshAnimation()
        TriggerServerEvent('royal-phone:server:answerCall')
        PhoneSend('answerCall', true)
    end
end, false)

RegisterCommand('royalphone_decline', function()
    if not currentCall then return end

    if currentCall.state == 'incoming' then
        TriggerServerEvent('royal-phone:server:declineCall')
    else
        TriggerServerEvent('royal-phone:server:endCall')
    end
end, false)

RegisterKeyMapping('royalphone_answer', 'Royal Phone - Answer call', 'keyboard', Config.AnswerKey)
RegisterKeyMapping('royalphone_decline', 'Royal Phone - Decline / hang up', 'keyboard', Config.DeclineKey)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end

    setVoiceChannel(0)
end)
