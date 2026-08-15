# royal-phone

A flip-out phone for FiveM. React + Tailwind + framer-motion NUI, Lua bridge for
QBX / ESX / OX / ND / standalone.

## Install

1. Drop the folder in `resources/[custom]/` and add `ensure royal-phone` to your
   server config (after `ox_lib` and `oxmysql`).
2. Set `Config.Framework` in `config.lua`.
3. Copy the two items from `ox_inventory_items.lua` into
   `ox_inventory/data/items.lua`.

**The database sets itself up.** `server/migrate.lua` runs `sql/royal-phone.sql`
on every start and creates whatever is missing, so you never run it by hand and
never have to run it again after an update. Every statement is
`CREATE TABLE IF NOT EXISTS`, and column additions go through a checked helper
rather than a bare `ALTER`, so it is safe to run on every boot. New tables are
logged to the console the first time they appear.

`pma-voice` is optional but recommended — it is what carries call audio. Without
it the calls still connect and the UI works, they just have no voice. It is not a
hard dependency, so load order does not matter.

The UI ships pre-built in `web/build`, so no build step is needed to run it.

## Controls

| Action | Input |
| --- | --- |
| Toggle phone | `M` (rebindable in FiveM keybinds) or `/phone` |
| Close app / close phone | Home indicator at the bottom, or `Escape` |
| Flip out | Map icon, top-right of the status bar |
| Rearrange apps | Hold an icon, then drag |
| Change page | Drag an icon to either edge, swipe, or tap a page dot |
| Answer a call | `Y` |
| Decline / hang up | `N` |

## Moving with the phone open

WASD, sprint and jump stay with the game, so the player walks and drives as normal
with the phone up. **The camera is deliberately locked** — the mouse belongs to the
phone, and every swipe across the screen would otherwise spin the player round.
Weapons, melee and the pause menu are suppressed too.

The ped holds the phone in front of them while it is open, and **to their ear for
the duration of a call** — pocketing the phone mid-call keeps the ear pose rather
than dropping the animation.

The catch that makes this work: with input handed back, **every keystroke reaches
both the UI and the game** — typing "was" into a message would also send the ped
walking. So the UI reports caret focus to Lua (`focusin`/`focusout` on any input,
textarea or contenteditable) and Lua drops *all* control for exactly as long as a
text box is focused. Set `Config.AllowMovement = false` for the old behaviour
where the phone takes everything and the player stands still.

## SIM cards

With `Config.RequireSim` the phone is only hardware. The identity — number,
contacts, messages, groups, documents, Lifeinvader accounts — belongs to the **SIM
card**, which carries a serial in its ox_inventory metadata.

**The card goes inside the phone.** The phone item is an ox_inventory container
with a single slot — that slot is the SIM tray. Open the phone in your inventory
and drop the card in. The resource reads the phone's container first and only then
falls back to a card loose in your pockets, so either arrangement works, but the
tray is the intended one.

Give the phone's container a `whitelist = { 'simcard' }` or the single slot will
happily hold a burger.

A blank card registers itself to whoever first puts it in a phone: it gets a
serial, a number, and a `description` on the item showing that number. From then
on everything is keyed to the serial rather than the character.

The consequence is the point of the feature: **put someone else's SIM in your
phone and you are reading their messages.** Settings › SIM Card says whose card it
is and marks it "Borrowed" when it is not yours. Texts you send from a stolen card
still go out under *your* name — the card is the account, not the identity.

Two things deliberately stay with the character, not the card:

- **Banking.** Money is the player's, not the card's. A stolen SIM must not hand
  over somebody's bank account.
- **The home screen layout**, which is per-character KVP.

| Setting | Default | Does |
| --- | --- | --- |
| `Config.RequireSim` | `true` | Require a registered SIM. ox_inventory only. |
| `Config.SimItem` | `'sim_card'` | Item name to look for. |
| `Config.SimPrefix` | `'SIM'` | Prefix on generated serials. |

> **The phone will not open until `sim_card` exists as an ox_inventory item.**
> Copy it from `ox_inventory_items.lua`, or set `Config.RequireSim = false`.

Never let the SIM item stack — each card holds its own identity in metadata, and
stacking would merge two phone numbers into one slot. The definition in
`ox_inventory_items.lua` already sets `stack = false`.

## Test commands

| Command | Does |
| --- | --- |
| `/testnotify` | One notification from the phone |
| `/testnotify bank` | One from a given app id |
| `/testnotify messages 4` | Four in a row, to watch them group in the centre |
| `/testmessage hello` | Writes yourself a real text — exercises the toast, the routing and the unread badge, not just the banner |

## Home screen

The layout is one flat, ordered list — pages are derived from however many
columns fit right now. Folded that's 4 × 5; unfolded the same order reflows into
a wider grid (columns are measured from the actual frame width and rounded to a
multiple of four, so a viewport too narrow for a true 3× degrades to 8 columns
rather than squashing 12). A second page only exists once the first is full.

Pages are stored explicitly rather than derived, because an empty page has to be
able to exist — that is what dragging an icon off the right edge creates. Hold an
icon against the right edge to move it to the next page (or make one past the
last); against the left edge to go back, except on page one. Empty pages are
tidied up when edit mode ends.

Four dock slots, stored alongside. Layout and settings persist per character in
one KVP blob (`royal-phone:layout:<citizenid>`) — one debounced write, one read,
no database round trip.

## Icon artwork

Drop `<app-id>.webp` into `web/src/assets/icons/` — `bank.webp`, `doj.webp` and
so on, matching the `id` in `web/src/config/apps.jsx` — and it replaces that
app's gradient tile on the home screen, the dock, toasts and the notification
centre. Apps without a file keep their Hugeicons glyph. Filenames are matched
case-insensitively, and an entry can point at a differently-named file with an
`image` field.

The ids are: `calculator` `documents` `doj` `fishing` `bank` `gallery` `garage`
`lifeinvader` `music` `news` `estate` `settings` `ventures` `underground`
`hustlr` `cliq` `weather` `dialer` `messages` `contacts` `browser` `camera`.

The list is resolved by `import.meta.glob` at build time, so a missing file
costs nothing at runtime and only files that exist are bundled. Two consequences
worth knowing: adding artwork needs `npm run build`, and if the dev server is
already running when you add a file, restart it — Vite caches the glob.

## Sounds

`.mp3` files in `web/src/sounds/` are bundled and playable by filename. Two are
wired up:

| File | Plays when |
| --- | --- |
| `newnotification.mp3` | Any notification arrives |
| `newmessagesent_inapp.mp3` | You send a message |
| `ringtone.mp3` | A call is ringing in — loops until answered, declined or ended |

The ringtone loops rather than firing once: a one-shot blip would be over before
the player had reached for the phone. It is silenced by every exit from a ringing
call, including `setCall` moving off `incoming`, so no route can leave it playing.

Settings › Sounds has the mute toggle and a volume slider, with a test button.
Pass `sound: false` on a notification to add it silently. Same glob rules as the
icon artwork: adding a file needs a rebuild, and a restart if the dev server is
already running.

## Wallpaper

Settings › Wallpaper & Zoom takes a direct image URL. It must point at an image
file, not the page hosting it. Applied and saved as you type — the Set button
just skips the debounce. Leave it empty for the plain black screen. The URL is
stored per character with the rest of the settings.

## Notifications

Toasts drop in under the status bar and lift back out the same way. Swipe up or
hit the × to dismiss; tapping one opens the matching app.

The bell opens the notification centre: a row of quick toggles (sounds, do not
disturb, airplane, rearrange apps, settings), a divider, then the list. Two or
more consecutive notifications from the same app collapse into one card with a
count and a summary line — tap to expand the individual entries or clear the
whole stack. "History" flips between everything and unread only.

Every app carries a red bubble on its home icon while it has an unacknowledged
notification, merged with its own unread counts (mail, missed calls). Opening
the app clears it.

Tapping a notification — in the centre or on the toast — opens its app and
dismisses the sheet. Give the notification a `route` to land on a specific
screen rather than the app's front page:

```lua
exports['royal-phone']:Notify({
    app = 'messages',
    title = 'Mikkel',
    content = 'meet me at the pier',
    route = { number = '555-0192' },   -- opens that conversation
})
```

Messages takes `{ number }`, the Phone app takes
`{ tab = 'calls' | 'keypad' | 'contacts' }`, and Documents takes `{ id }`.
Incoming texts and document invites set this for you.

### Offers

Anything that puts something in someone else's phone — a shared contact, a
document invite — arrives as a notification with **Accept / Decline on it** and
writes nothing until answered. The exchange happens on the phone rather than in a
separate dialog, so it lands the same whether the phone is open, pocketed or
peeking.

Offer toasts cannot be swiped away or tapped through: the only ways out are the
two buttons. The client hands back a token, never the payload — the server reads
what was offered from its own record, so a client cannot accept a contact nobody
offered it. Offers expire after two minutes.

**Group invites** work the same way: being dropped into a group chat without a say
is the same problem as having a contact pushed at you. Invite someone who is
offline and they are simply added — there is nobody to ask, and a group you were
told about but never joined is worse than one that is waiting for you.

Document invites to an **offline** player are written straight away instead, since
there is nobody to ask and a document that only appears if you happened to be
online is worse than one that is simply there.

The pocketed phone has three resting heights:

| Mode | Shows | Triggered by |
| --- | --- | --- |
| Call | Status bar only — half the peek height | A call is running |
| Peek | Status bar and the banner, and nothing more | A notification, or the call card |
| Open | Everything, bottom-right | The keybind, or tapping the phone |

Peek height is measured off the **card**, not the phone: the bottom of the toast
plus 5&nbsp;px. It used to be a fraction of the device height, which lifted about a
third of the phone into view to show a one-line banner.

The phone drops back down after `Config.PeekDuration` (1.5&nbsp;s) rather than
riding out the whole notification — the banner is readable in a glance, and a
phone that pops up mid-drive should get out of the way. The toast carries on in
the tray.

A notification arriving while the phone is pocketed makes the phone itself peek
up from the bottom edge, showing the banner, then drop back once the toast
expires — or after 6 s, whichever is first. The cap matters: the phone has no
NUI focus while peeking, so a `duration = 0` notification would otherwise pin it
on screen with no way for the player to dismiss it. Sticky notifications are
still waiting in the tray when the phone is next opened.

## Calls

Voice runs through **pma-voice**. Both ends of a call are handed the same call
channel the moment the receiver picks up, and taken off it when either side hangs
up. Set `Config.Voice = 'none'` to run the UI without it; the calls still connect,
they just carry no audio.

The flow, because the middle step is the one that matters:

1. Caller dials — `royal-phone:server:call`. The server reserves a channel and
   rings the receiver. The caller sits on **Ringing…**; nothing is connected yet.
2. Receiver answers — `royal-phone:server:answerCall`. Only now does the server
   confirm the pickup to **both** clients, and only then does either one join the
   voice channel.
3. Either side hangs up, declines, or disconnects — both are dropped off the
   channel together, and the caller is told *why* (declined, unavailable) rather
   than the call silently vanishing.

The UI never flips itself to "connected" on its own. It waits for the server,
because the caller has no way of knowing the other end picked up — and a screen
that says connected while no channel exists is worse than one that says ringing.

**Mute** is the only in-call control. It drops the player off the call channel and
puts them back on it, which from the other end is indistinguishable from being
muted and needs no changes to pma-voice. Speaker and Video are gone: they lit up
and did nothing, because there is no second audio route to switch to and no video
stream to send.

Nothing is live-updated by polling. When something changes that a player's open
phone should know about — a contact accepted, a document shared, a group edited —
the server pushes a `refresh` for that slice and the phone re-pulls just that
part, coalesced and skipped entirely when the phone is closed.

A call keeps running wherever you are. The home indicator tucks a full-screen
call into the green status-bar chip so the rest of the phone stays usable, and
pocketing the phone drops it to **call mode** — parked low at the bottom of the
screen, chip still ticking, and it will not go away until the call ends.

### Call mode and peek mode never take the mouse

Both are display-only. The phone is on screen, the game keeps the cursor, and the
player carries on driving or shooting. Answer, decline and hang up are keybinds
instead, shown on the card itself:

| Key | Does |
| --- | --- |
| `Config.AnswerKey` (`Y`) | Answer a ringing call |
| `Config.DeclineKey` (`N`) | Decline a ringing call, or hang up a live one |
| `Config.OpenKey` (`M`) | Open the phone properly |

An **incoming** call does **not** open the phone. It rises to peek height showing
the call card and the two keys. Opening the phone on a ring meant a call arriving
mid-firefight yanked the mouse away, which is the opposite of what anyone wants
from a ringing phone. With the phone already open it rings full screen.

## Size

Settings › Wallpaper & Zoom scales the whole device with Default / Medium /
Large presets — 100%, 115% and 130%. 100% is the default frame; it only scales
up. Saved settings from before the rebase are clamped into range on load. Everything follows:
the home grid sizes off `--pw`, and app screens are wrapped in `ScreenScale`,
which applies CSS `zoom` so a 15px label stays 15px *relative to the phone* at
any size. The choice is saved alongside the layout.

## Apps

**Phone**, **Messages**, **Contacts**, **Camera**, **Bank**, **Gallery**,
**Lifeinvader**, **Fishing**, **Documents**, **Calculator** and **Settings** are
implemented. Everything else renders `StubApp` ("Coming soon").

The dock is Phone → Messages → Contacts → Camera; Browser sits on the grid.

### Camera

**The viewfinder is the phone screen.** While the camera is open the shell drops
the wallpaper and the black backing, so the screen becomes a hole you look through
— the player holds the phone up and frames the shot through it, exactly like a
real one. The home screen stands down for the same reason: it would show through.

Everything drawn is the furniture around that hole, in the phone's own language —
26px-free header chips, the sky accent on the zoom rail, the same glassy
`bg-black/45` borders used elsewhere.

Mouse-first, because that is what the player's hand is already on:

| Input | Does |
| --- | --- |
| Scroll | Zoom, 1.0× to 4.0× |
| Middle click | Flip between rear and selfie |
| Right click | Shutter |

They are bound on the window rather than on buttons, so the whole screen is the
control surface with nothing to aim at. The on-screen shutter, flip and gallery
buttons duplicate them rather than replacing them.

`client/apps/camera.lua` owns the actual camera: a scripted cam attached to the head
bone (so the shot rides the ped's animation) aimed from the player's own look
input each frame. Selfie mode swings the heading 180° and inverts the pitch —
without that a selfie points at the back of their head and tilts the wrong way.
Zoom maps onto field of view, 75° wide down to 22° tight.

**The camera app is the one place the phone gives mouse-look back.** Everywhere
else the phone pins the camera because the mouse belongs to the UI; here the mouse
*is* how you aim the lens, so `client/main.lua` skips those `DisableControlAction`
calls while `PhoneCameraActive`.

Capture hides the viewfinder's own chrome for the frame it grabs — otherwise the
brackets and buttons end up in the photo — then restores it and files the shot in
the Gallery. Needs `screencapture` running; without it the shutter reports failure
rather than saving a blank.

The scripted camera lives exactly as long as the app screen does — started on
mount, stopped on unmount — so there is no separate state to get out of step.
Pocketing the phone unmounts the app and stops it; `Close()` in Lua stops it too,
and so does the character unloading or the resource restarting.

### Contacts

Its own dock icon, but **not its own implementation** — it mounts the exact screen
the Phone app used to show inline, through the shared `ContactsTab`, `PhoneNav`
and `useDial` exports in `DialerApp.jsx`. Adding, editing, sharing and searching
behave identically because there is only one of each.

**One bottom bar across three apps.** Calls, Keypad, Messages, Contacts — the same
four slots wherever you are standing, with the current one highlighted. Calls and
Keypad are screens inside the Phone app; Messages and Contacts are apps of their
own, so `PhoneNav` routes to whichever owns the tab you tapped. Nothing is
highlighted mid-call, because the call is not one of the four.

The one behavioural difference is where a call goes. The Phone app renders the
call itself, so it dials `minimized` and owns its own screen; Contacts has no call
UI, so it dials un-minimized and hands over to the global call overlay. Without
that split a call placed from Contacts would show nothing but the status-bar chip.

`Contacts.webp` in `assets/icons/` was already sitting unused — it binds to this
app's id automatically.

### Documents

Three tabs: **Inbox** (search, a status filter and the document list), **Notifications**
(anything waiting on your signature, then recent activity) and **Templates**
(starting points — blank, investment agreement, employment contract, bill of sale;
add your own to `TEMPLATES` in the app).

Each card leads with its status — Draft, Needs you, Pending, Completed — derived
from the signature rows rather than stored separately, so there is no second copy
of the truth to fall out of step. The banner is a thin bar down the left of the
card; inside the document it still runs full width behind the header.

### Signing

A document owner can **send it for signing**. Every party — the owner and everyone
invited — gets a signature row, and the document **locks the moment the last one
signs**: the point of a contract is that what was agreed cannot be edited
afterwards, so `canEdit` goes false for everybody once it is sealed.

The parties are snapshotted when it goes round. Adding someone afterwards would
change what the others already agreed to, so it does not happen — withdraw it to a
draft and send it again instead.

Signing is re-checked server-side against the signature rows, not against whether
the button was shown. Everyone on the document gets a live refresh as each
signature lands, and a notification when the last one does.

Write a document, pick a banner for it, and invite other numbers to read or
edit.

The editor is `contentEditable` plus `execCommand` — bold, italic, underline,
strikethrough, bullets, numbering, quote, and Body / Title / Heading /
Subheading blocks. Deprecated API, but the only rich-text primitive every
Chromium build implements identically, and it keeps an editor library out of a
bundle read off disk on every phone open. The surface is uncontrolled on
purpose: re-rendering a `contentEditable` from React state puts the caret back
at the start on every keystroke.

Body HTML is rebuilt from an allow-list (`web/src/utils/richtext.js`) on the way
in *and* on the way out, and pastes are forced to plain text — a document is
written by one player and read by everyone invited, so its markup is untrusted
input coming back out of the database. Tags outside the list contribute their
text but not themselves; attributes never survive at all.

Saves debounce at 800 ms and flush when the screen closes. Two tables back it:
`royal_phone_documents` and `royal_phone_document_shares`.

**Sharing is contacts and nearby players only.** The panel has those two tabs and
no free-text number field, and the server enforces the same rule rather than
trusting the client — a saved contact, or someone within `Config.NearbyRange`.
An open number box would also have been a way to discover which numbers exist by
trying them.

The owner alone manages the guest list and is the only one who can delete — for an
invited player, delete means leave. Invitees get a notification routed to the
document. `Config.DocumentMaxLength` caps the stored body.

Banners are CSS gradients listed in `web/src/config/banners.js`, stored as a
short id. Add one there and it appears in the picker; no file can 404 on a
document written months ago.

### Calculator

Display, tape and keypad. Arithmetic runs on an explicit accumulator rather
than by parsing a string, so nothing resembling `eval` goes near player input.
AC turns into a backspace once there is a number to trim, `%` takes a
percentage *of* the pending left-hand side (200 + 10% is 220), and the keyboard
drives all of it. The tape keeps the last 30 results — tap one to put it back
in the display. Nothing persists; the history dies with the screen.

### Lifeinvader

The city's social network, with its own bottom navigation: feed
(Following / Live / Discover), stories, marketplace, compose, search,
notifications and settings.

A character signs up with a handle, display name, picture and bio, and can hold
several handles and switch between them. Posts take text and a gallery photo,
and carry likes, reposts and replies. The marketplace is a two-column grid of
listings with a price and seller. Follows and blocks are per account.

Six tables (`royal_phone_li_*`) back it. The server always resolves which
account a request is acting as from the caller's identifier rather than trusting
the client, so a player cannot post as someone else's handle.

Posts take a gallery photo or a pasted link. `utils/embed.js` works out what a
link is: images and video files render inline, YouTube renders as a thumbnail
that swaps to a player on tap (a feed of live iframes would initialise every
player at once), and anything else becomes a link card.

**Live** is streams only — ordinary posts never appear there. Streams come from
`live` in the store: `{ id, handle, name, title, viewers, thumb, url }`.

**It is live.** The phone fetches data once per open and never polls, which meant
a feed opened five minutes ago was five minutes stale and you never saw anyone
else's posts. The server now broadcasts a bump whenever anyone posts, likes,
comments, follows or lists, and each client re-pulls — coalesced to one query per
1.5 s and skipped entirely unless that player's phone is actually on screen, so a
busy server does not turn every like into a query storm.

Search and Discover read a real **account directory** (`people`) rather than
deriving people from whoever happened to appear in your feed. Someone who has
never posted can now be found and followed — before, they were invisible.

In-app notifications are populated: likes, comments and follows file a row in
`royal_phone_li_notifications` and push a phone notification to the owner if they
are online. Opening the screen marks them read.

Two gaps remain: reposts are counted in the UI but have no table, and `live` is
read-only — nothing marks a player as streaming.

### Fishing

Four tabs:

- **Home** — your journey: level, rank (Novice → Legend) with an XP bar and the
  next rank, biggest and rarest catch, totals for fish and earnings, your boat
  (locked until level 10) and recent catches.
- **Workshop** — harvesting gear, the equipment catalog with equipped rod/bait
  slots, and All / Rods / Bait filters.
- **Zones** — open zones with what's biting; locked ones show their level
  requirement, and the eye toggle hides them.
- **Catches** — the bucket, with a sell-all action; empty until you fish.

Reads `fishingStore`, fed by the fishing resource through the bootstrap payload:
`level`, `xp`, `xpToNext`, `stats`, `boat`, `recent`, `bucket`, `harvesting`,
`equipment`, `equipped` and `zones`. Tapping an open zone drops a waypoint.
Nothing on the Lua side populates it yet — the app is read-only and runs on mock
data in dev.

`RANKS` and `BOAT_LEVEL` in the store set the rank titles and the boat unlock;
change them there rather than in the app.

### Gallery

Gallery groups shots into day sections (Today / Yesterday / weekday / date),
stamps each thumbnail with its time, and its viewer steps between photos and
shows the full date. "Send in a message" carries the photo into Messages, where
it waits above the composer until a conversation is picked.

Contacts can be edited, picture included — a direct image URL or a shot picked
from the Gallery. **Share** offers a contact (or your own card, from My Cards) to
a player standing next to you — and it only *offers*. They get a dialog and must
accept before anything is written; pushing a contact straight into someone's phone
is not something they agreed to, and it made "share" a way to spam anyone standing
near you. One pending offer per person, expiring after 30 s.

The server measures the distance itself and reads the number out of your contact
list rather than the payload, so this cannot be used to inject contacts into an
arbitrary player. `Config.NearbyRange` sets how close counts.

Texting someone you have never texted works: the conversation is synthesised
empty. `useThreads` only builds threads out of messages that exist, so the Phone
app's message button used to select a thread that was not there and silently drop
back to the list — which looked exactly like the button doing nothing. Groups have an owner: they can rename, invite, kick and delete,
while members can only leave. Emoji are a curated set in `web/src/config/emoji.js`
with a Recent tab driven by a per-character usage tally (a picker library like
emoji-mart ships about a megabyte of index data, which is a bad trade for a NUI
bundle read off disk on every open).

### Bank

Balances come from the framework bridge, so QBX cash and bank are live with no
extra wiring. **Transfer** moves money for real: the server debits the sender
first and aborts if the balance cannot cover it, so a failed transfer never
credits anybody. Sending to an offline character parks the amount in
`royal_phone_bank_pending` and credits it on their next phone open rather than
dropping it.

Activity comes from `royal_phone_bank_transactions`, the phone's own ledger.
Transfers write themselves in; hook your payroll, shops or banking resource in
with the export:

```lua
exports['royal-phone']:AddTransaction(source, 'Paycheck', 1850)
exports['royal-phone']:AddTransaction(source, 'Vehicle fuel', -93)
```

Negative for money out. The "last 7 days" figure is the net of those.

Money movement goes through `Bridge.MoveMoney(src, account, amount, reason)` —
`'cash'` or `'bank'`, negative to take away, returning false when the player
cannot cover it. QBX, ESX and ND are implemented; ox_core only does cash (it has
no bank of its own) and standalone returns false.

### Groups

Membership lives in `royal_phone_group_members`, one row per person. It used to
be a JSON blob on the owner's row, which meant **only the owner's phone ever knew
the group existed** — everyone else saw nothing, and group messages were filed
under a key none of them queried. `migrate.lua` moves old groups across on first
boot.

Consequences of the new shape, all of which are the point:

- Every member sees the group, owner or not.
- **Offline members get the backlog.** A group message is one row under the group
  key; the fetch now includes every group you belong to, so nothing is lost by
  being away when it was sent.
- Unread is a per-member watermark (`last_read`) rather than a flag on the
  message, because one row serves the whole group.
- Membership is read from the database when fanning out, never from the client —
  a client-supplied member list is a way to text people who are not in the group.

Owners get **group settings** in the thread's overflow menu: rename, a picture
picked from the Gallery, invite by contact or number, kick, and delete. Members
see the same panel with only Leave. Every failure says why — an empty name or an
unknown number now reports back instead of the button doing nothing.

### Voice notes

Recorded in NUI with `MediaRecorder` when the client's CEF allows microphone
access, and played back in the bubble with a scrubbable waveform.

**The clip is stored with the message**, so this works with nothing configured.
`Config.VoiceMaxSeconds` (20 s, the recorder stops itself) and
`Config.MediaMaxLength` are what keep that from filling the table with audio. Set
`Config.VoiceUpload` to POST clips to a host instead and store a URL; if that host
fails the clip is kept inline rather than lost.

With no microphone at all the message still sends as a placeholder with its
duration, and `royal-phone:client:voiceMessage` still fires so a voice resource
can attach the clip. A note with no `media` shows its length but does not pretend
to play.

> Attachments are stored on the message — `kind`, `media`, `seconds` and
> `location` columns. They used to be sent to the recipient and then thrown away,
> so a photo, a voice note or a shared location survived only until someone
> reopened their phone, at which point it came back as a bare line of text. That is
> also why tapping a shared location set no waypoint: the coordinates were gone.

### The composer

`+` on the left, the field in the middle with emoji and send inside it, and the
microphone on the right — **always there**, whatever the field contains. It used
to swap places with the send button as you typed, which made it impossible to aim
for.

`+` floats a row of round buttons over the field rather than pushing it down, so
the composer never moves under your thumb. Photo and Share location live there;
emoji stays inside the field where it belongs.

Messages supports group threads, emoji, photos from the Gallery and voice notes.
It is built to mirror the Phone app: the same header, the same search field over
plain avatar rows, and the same four-slot bottom navigation — All, Unread,
Groups, and Calls, which is a shortcut into the Phone app the way the Phone
app's Messages tab is a shortcut into here. Search matches name or number, and
the tick in the header marks every conversation read.
Threads are separated by day with TODAY / YESTERDAY / weekday / date dividers.
Groups live in `royal_phone_groups`; sending to one fans out to every member
server-side while each phone files it under the same conversation.

**Voice notes are a UI shell.** NUI has no microphone, so releasing the record
button fires the `royal-phone:client:voiceMessage` event with a duration and
sends a placeholder bubble. Hook a voice resource to that event to capture and
attach real audio.
To build one out, add a `component` to its entry in `web/src/config/apps.jsx` —
the id is what the saved layout stores, so don't rename ids that are already
live. An optional `background` class on the entry sets the app's backdrop.

Apps are full bleed and opaque: the background runs edge to edge with the status
bar and home indicator drawn on top of it, so the chrome always sits on the
app's own colour. `AppShell` handles the padding for you.

## Exports

Client:

```lua
exports['royal-phone']:Open()
exports['royal-phone']:Close()
exports['royal-phone']:Toggle()
exports['royal-phone']:IsOpen()

exports['royal-phone']:Notify({
    app = 'messages',      -- app id, drives the icon and colour
    title = 'Mikkel',
    content = 'meet me at the pier',
    duration = 5000,       -- 0 keeps it up until dismissed
})
```

Server:

```lua
exports['royal-phone']:Notify(source, data)
exports['royal-phone']:SendMessage(source, 'Maze Bank', 'Deposit received.')
exports['royal-phone']:GetNumber(source)
```

## Development

```bash
npm --prefix web install
npm --prefix web run dev
```

Open <http://localhost:5174>. Outside FiveM the UI loads mock data and shows a
dev panel: app notifications, four people who can text you (each writes a real
thread entry as well as raising the toast), a text storm, a notification burst,
an incoming call, and layout reset.

Point `ui_page` at `http://localhost:5173/` in `fxmanifest.lua` to develop
against a live server, then `npm --prefix web run build` and switch it back.

## Performance

- No polling. Player data is fetched once per open, the clock is pushed on a
  1 s tick, and the only per-frame loop (pause-menu suppression) runs solely
  while the phone is on screen.
- One app component is mounted at a time, so timers and subscriptions die with
  the screen.
- Layout writes go to KVP, not the server.
- All geometry derives from CSS custom properties published by the frame, so the
  UI scales with resolution instead of reflowing.
