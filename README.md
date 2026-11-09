<div align="center">

# Royal Phone

**A fast, modern phone for FiveM.**

Real voice calls · texts and group chats · a social network · banking · signable contracts · SIM cards · an API for your own apps

[**Documentation**](https://royal-fivem.github.io/royal-phone/) ·
[Installation](https://royal-fivem.github.io/royal-phone/installation.html) ·
[Make your own app](https://royal-fivem.github.io/royal-phone/custom-apps.html) ·
[Exports & events](https://royal-fivem.github.io/royal-phone/api.html)

![Frameworks](https://img.shields.io/badge/frameworks-QBX%20%C2%B7%20ESX%20%C2%B7%20ox__core%20%C2%B7%20ND%20%C2%B7%20Standalone-0ea5e9)
![License](https://img.shields.io/badge/license-GPL--3.0-blue)

</div>

---

## Features

- **Calls with real voice.** pma-voice call channels, ringing, missed-call notifications and a call log.
  Answer or hang up with a key while you drive. The phone never steals your mouse.
- **Messages.** Texts, group chats, photos, voice notes, shared locations and emoji. Players who were
  offline get everything they missed.
- **SIM cards.** The number, contacts, messages and photos belong to the card, not the character. Steal
  someone's SIM and you're reading their messages.
- **11 built-in apps.** Phone, Messages, Contacts, Camera, Gallery, Bank, Garage, Documents,
  Lifeinvader, Calculator and Settings.
- **Signable documents.** Write contracts, share them with nearby players, and lock them once everyone has signed.
  Other scripts can send contracts too.
- **Walk and drive with it open.** Movement stays with the game, and typing never moves your character.
- **Your own apps.** Any resource can add an app with plain HTML. A template, SDK and UI kit are included.
- **Drop-in.** The UI is pre-built and the database sets itself up. No SQL to import, no build step.
- **Light on the server.** No polling. Data loads when the phone opens, and changes are pushed only to the
  players who need them.

## Requirements

| Resource | | Used for |
| --- | --- | --- |
| [ox_lib](https://github.com/overextended/ox_lib) | **Required** | Callbacks, commands, notifications |
| [oxmysql](https://github.com/overextended/oxmysql) | **Required** | Storage |
| QBX, ESX, ox_core or ND | Recommended | Names, money and vehicles (standalone also works) |
| [pma-voice](https://github.com/AvarianKnight/pma-voice) | Optional | Call audio |
| ox_inventory | Optional | The phone item and SIM cards |
| [screencapture](https://github.com/itschip/screencapture) | Optional | The Camera app |

## Quick start

1. **Add the resource.** Put the `royal-phone` folder in your resources and start it after its dependencies:

   ```cfg
   ensure ox_lib
   ensure oxmysql
   ensure royal-phone
   ```

2. **Pick your framework** in `config.lua`:

   ```lua
   Config.Framework = 'QBX' -- 'QBX' | 'ESX' | 'OX' | 'ND' | 'STANDALONE'
   ```

3. **Add the items.** Copy `phone` and `simcard` from `ox_inventory_items.lua` into
   `ox_inventory/data/items.lua`. No items? Set `Config.RequireItem = false` and `Config.RequireSim = false`.

4. **Check `fxmanifest.lua`** uses the built UI: `ui_page 'web/build/index.html'`.

5. **Restart** and press <kbd>M</kbd> (or type `/phone`). The database tables are created on first start.

Full guide: [Installation](https://royal-fivem.github.io/royal-phone/installation.html) ·
every option: [Configuration](https://royal-fivem.github.io/royal-phone/configuration.html)

## Controls

| Action | Default |
| --- | --- |
| Open / close the phone | <kbd>M</kbd> or `/phone` |
| Back / leave an app | <kbd>Esc</kbd> |
| Answer a call | <kbd>Y</kbd> |
| Decline / hang up | <kbd>N</kbd> |
| Open the notification that just arrived | <kbd>M</kbd> while the phone peeks up |

Players can rebind every key in *Settings › Key Bindings › FiveM*.

## For developers

Send texts and notifications from any script. A `target` can be a player **or a phone number**, and a number
works even when its owner is offline:

```lua
local phone = exports['royal-phone']

phone:SendMessage(source, 'Maze Bank', 'Your card was used at 24/7.')
phone:Notify('555-0134', { app = 'bank', title = 'Paycheck', content = '$1,850 received' })
phone:AddContact(source, { name = 'LSPD Dispatch', number = '911' })

AddEventHandler('royal-phone:callEnded', function(call)
    print(('%s talked to %s for %ds'):format(call.callerNumber, call.receiverNumber, call.duration))
end)
```

Add your own app from any resource:

```lua
AddEventHandler('royal-phone:client:registerApps', function()
    exports['royal-phone']:CustomApp({
        id = 'taxi',
        name = 'Taxi',
        icon = 'ui/icon.png',
        ui = 'ui/index.html',
    })
end)
```

Copy [`template/royal-phone-app`](template/royal-phone-app) to get started: it's a complete, working example.

- [Make your own app](https://royal-fivem.github.io/royal-phone/custom-apps.html): template, SDK and UI kit
- [Exports & events](https://royal-fivem.github.io/royal-phone/api.html): every export and event, with examples
- [Frameworks & bridge](https://royal-fivem.github.io/royal-phone/frameworks.html): supporting another framework
- [Working on the UI](https://royal-fivem.github.io/royal-phone/development.html): changing the phone itself

### Building the UI

You only need this if you change files in `web/src`.

```bash
npm --prefix web install
npm --prefix web run dev     # http://localhost:5174, runs on mock data
npm --prefix web run build   # writes web/build, which ships with the resource
```

## Documentation

The full documentation is at **[royal-fivem.github.io/royal-phone](https://royal-fivem.github.io/royal-phone/)**.
Its source is in [`docs/`](docs).

Having trouble? See [Troubleshooting & FAQ](https://royal-fivem.github.io/royal-phone/troubleshooting.html), or
[open an issue](https://github.com/royal-fivem/royal-phone/issues).

## License

Royal Phone is released under the [GNU General Public License v3.0](LICENSE).
