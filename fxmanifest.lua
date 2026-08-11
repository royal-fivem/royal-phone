fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'royal-phone'
description 'royal-phone — high performance flip phone'
author 'Royal'
version '1.0.0'

ui_page 'web/build/index.html'
-- ui_page 'http://localhost:5173/' -- dev

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'bridge/server/*.lua',
    -- Order matters: the schema is created first, then the identity layer every
    -- other file resolves "whose phone is this" through.
    'server/migrate.lua',
    'server/identity.lua',
    'server/main.lua',
    'server/lifeinvader.lua',
    'server/documents.lua',
    -- Additive: lets other resources (e.g. pawnshop) send signable contracts.
    'server/contracts.lua',
}

client_scripts {
    'bridge/client/*.lua',
    'client/main.lua',
    'client/camera.lua',
}

files {
    'web/build/index.html',
    'web/build/**/*',
}

dependencies {
    'ox_lib',
    'oxmysql',
}
