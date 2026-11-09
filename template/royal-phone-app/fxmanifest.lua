fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'royal-phone-app'
description 'Example custom app for royal-phone — copy, rename, build on it'
version '1.0.0'

shared_script '@ox_lib/init.lua'

client_script 'client.lua'
server_script 'server.lua'

-- Everything the app page loads must be listed here, or FiveM will not serve it.
files {
    'ui/*',
    'ui/**/*',
}

dependencies {
    'royal-phone',
    'ox_lib',
}
