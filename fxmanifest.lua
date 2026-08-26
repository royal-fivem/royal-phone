fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'royal-phone'
description 'royal-phone — high performance flip phone'
author 'Royal'
version '1.0.0'

-- ui_page 'web/build/index.html'
ui_page 'http://localhost:5174/' -- dev

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'bridge/server/*.lua',
    'server/migrate.lua',
    'server/identity.lua',
    'server/upload.lua',
    'server/bank.lua',
    'server/main.lua',
    'server/apps/*.lua',
}

client_scripts {
    'bridge/client/*.lua',
    'client/main.lua',
    'client/apps/*.lua',
}

files {
    'web/build/index.html',
    'web/build/**/*',
}

dependencies {
    'ox_lib',
    'oxmysql',
}
