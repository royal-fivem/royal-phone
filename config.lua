Config = {}

-- QBX, ND, ESX, OX, STANDALONE
Config.Framework = 'QBX'

-- Keybind used to toggle the phone. Players can rebind it in the FiveM
-- keybind settings ("Royal Phone - Toggle").
Config.OpenKey = 'M'

-- Command name registered for the keybind above (also usable in chat).
Config.Command = 'phone'

-- Require a phone item in the player's inventory before the phone opens.
-- Set to false for a "everyone has a phone" server.
Config.RequireItem = true
Config.ItemName = 'phone'

-- Inventory resource used for the item check. 'ox_inventory' | 'qb-inventory' | 'none'
Config.Inventory = 'ox_inventory'

-- SIM cards (ox_inventory only).
--
-- With this on, the phone is just hardware: the identity — number, contacts,
-- messages, documents, social accounts — belongs to the SIM card, not the
-- character. A blank SIM is registered to whoever first puts it in a phone and
-- keeps a serial in its item metadata from then on.
--
-- The consequence is deliberate: put someone else's SIM in your phone and you
-- read their messages. That is the point of stealing one.
Config.RequireSim = true
Config.SimItem = 'simcard'

-- Prefix on generated SIM serials, shown in Settings and on the item label.
Config.SimPrefix = 'SIM'

-- Block the phone while the player is dead / cuffed / in water.
Config.BlockWhenDead = true
Config.BlockWhenCuffed = true

-- Play the phone open/close animation on the ped.
Config.UseAnimation = true

-- How long (ms) a phone notification stays on screen by default.
Config.NotifyDuration = 5000

-- How long (ms) the pocketed phone stays peeked after a notification. Shorter
-- than NotifyDuration on purpose: the banner is readable in a glance and the
-- phone popping up mid-drive should get out of the way quickly. The toast itself
-- lives out its own duration in the tray.
Config.PeekDuration = 1500

-- Number generation used when a character has no number yet.
-- '###-####' -> 555-0134
Config.NumberFormat = '###-####'
Config.NumberPrefix = ''

-- Let the player walk, run and jump with the phone open.
--
-- The mouse belongs to the phone, so the camera is deliberately locked: you can
-- move but not look around, the same as any real phone-in-hand script. WASD,
-- sprint and jump stay with the game; mouse-look, weapons and melee do not.
--
-- Set to false for the old behaviour: the phone takes everything and the player
-- stands still until it is closed.
Config.AllowMovement = true

-- Call mode (a call running with the phone pocketed) and peek mode (a
-- notification, or an incoming call) are display-only: the game keeps the mouse
-- and the player carries on as normal. Answer, decline and hang up are on the
-- keys below, and the phone still reopens with Config.OpenKey.
Config.AnswerKey  = 'Y'
Config.DeclineKey = 'N'

-- Voice resource used to put both sides of a call on the same channel.
-- 'pma-voice' | 'none'
Config.Voice = 'pma-voice'

-- Longest voice message, in seconds. Clips are stored inline with the message,
-- so this is what keeps the messages table from filling up with audio: roughly
-- 4 KB per second, and the recorder stops itself at the limit.
Config.VoiceMaxSeconds = 20

-- Largest attachment (characters) kept on a message — voice clips and photo data
-- URLs. Anything bigger is dropped and the message sends without it, rather than
-- bloating the bootstrap payload every phone open has to read.
Config.MediaMaxLength = 400000

-- OPTIONAL: upload voice clips somewhere instead of storing them inline.
--
-- POSTs { audio = <data url>, seconds = <n> } and expects { url = '...' } back.
-- Left empty the clip is stored with the message, which works out of the box.
Config.VoiceUpload = ''
Config.VoiceUploadToken = ''

-- Send phone notifications even while the phone is closed (screen toast).
Config.NotifyWhenClosed = true

-- Largest document body (HTML, characters) the Documents app will store.
-- Anything longer is truncated server-side.
Config.DocumentMaxLength = 60000

-- How far away (metres) another player counts as "nearby" for sharing a contact
-- or inviting someone to a document.
Config.NearbyRange = 12.0
