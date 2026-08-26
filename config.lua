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

-- SIM cards (royal ox_inventory only).
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

-- Where photos and voice clips are kept.
--
-- 'database' — stored inline as base64. Works out of the box, costs table size
--              and bootstrap payload (see MediaMaxLength and the photo limits).
-- 'remote'   — POSTed to an upload host, only the URL it returns is stored.
--
-- The endpoint and its API key are set in server/upload.lua, NOT here: this file
-- is a shared script, so anything in it is downloaded by every client.
--
-- If the host is unreachable the media falls back to being stored inline rather
-- than being lost.
Config.MediaStorage = 'database'

-- Send phone notifications even while the phone is closed (screen toast).
Config.NotifyWhenClosed = true

-- Largest document body (HTML, characters) the Documents app will store.
-- Anything longer is truncated server-side.
Config.DocumentMaxLength = 60000

-- How far away (metres) another player counts as "nearby" for sharing a contact
-- or inviting someone to a document.
Config.NearbyRange = 12.0

-- With Config.MediaStorage = 'database', camera photos are stored as base64 and
-- the whole gallery ships to the UI on every phone open. These three keep that
-- payload sane (and the capture itself smaller when uploading remotely).
--
-- Encoding and size of the capture. Smaller is not just disk: it is what every
-- phone open has to download. 'webp' | 'jpg' | 'png'
Config.PhotoEncoding = 'webp'
Config.PhotoMaxWidth = 720
Config.PhotoMaxHeight = 405

-- Photos kept per phone. Taking one past the limit deletes the oldest.
Config.PhotoLimit = 30

-- Largest single photo (characters of base64). Anything bigger is refused
-- rather than written, so one huge frame cannot bloat every future phone open.
Config.PhotoMaxLength = 1500000

-- ─── Bank ────────────────────────────────────────────────────────────────────

-- The Bank app uses the framework's bank account (QBX/ESX/ND money, ox_core
-- accounts). Where there is none — STANDALONE, or ox_core without its accounts
-- module — it falls back to royal_phone_bank_accounts. Detected, not configured.

-- Largest single transfer. 0 removes the limit.
Config.BankMaxTransfer = 0

-- Keep the Invoices tab. Invoices are raised by other resources through the
-- royal-phone AddInvoice export: the player gets a notification they can pay or
-- decline, and the invoice stays on their record either way. With this off the
-- tab is hidden and AddInvoice does nothing.
Config.BankInvoices = true
