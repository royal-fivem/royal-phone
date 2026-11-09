# royal-phone-app

A working example of a custom app for royal-phone. Copy this folder, rename it
and build on it.

## Install

1. Copy `royal-phone-app` into your server's `resources` folder, **outside**
   `royal-phone`, and rename it (e.g. `taxi-app`).
2. Add `ensure taxi-app` to your server config after `ensure royal-phone`.
3. Change `APP_ID` in `client.lua` and `server.lua`, plus the `name` and
   `icon` in `client.lua`.

The app appears on everyone's home screen. `/exampleapp` opens it straight on
its contacts tab.

## Files

| File | What it is |
| --- | --- |
| `client.lua` | Registers the app and handles the page's `RoyalPhone.fetch` calls with `RegisterNUICallback`. |
| `server.lua` | Uses royal-phone's server exports: contacts, messages, app data, pushing to the page. |
| `ui/index.html`, `ui/app.js` | The app itself. Replace these. |
| `ui/royal-phone.js` | The SDK. Keep it, don't edit it. |
| `ui/royal-phone.css` | The UI kit. Keep it, and add your own styles next to it. |
| `ui/icon.svg` | Home screen icon. PNG and WebP work too. |

## Building the page without the game

Open `ui/index.html` in a browser, or serve the folder with any static server.
Outside the game, `RoyalPhone.ready()` resolves with a placeholder player and
`RoyalPhone.fetch(name, data, mock)` returns `mock`. The page renders and
clicks through without a server.

## How the pieces talk

```
ui/app.js ──RoyalPhone.fetch('x')──▶ client.lua RegisterNUICallback('x')
                                          │ lib.callback / TriggerServerEvent
                                          ▼
                                     server.lua ──exports['royal-phone']:…──▶ phone
                                          │
ui/app.js ◀──RoyalPhone.on('y')──── SendAppMessage(source, APP_ID, 'y', data)
```

The full reference, including every export, event and UI kit class, is in the docs:
[Make your own app](https://royal-fivem.github.io/royal-phone/custom-apps.html) and
[Exports & events](https://royal-fivem.github.io/royal-phone/api.html).
