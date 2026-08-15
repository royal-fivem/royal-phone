local function isTrue(value)
    return value == true or value == 1 or value == '1'
end

local function accountsFor(owner)
    return MySQL.query.await(
        'SELECT id, handle, name, avatar, bio FROM royal_phone_li_accounts WHERE identifier = ? ORDER BY id ASC',
        { owner }
    ) or {}
end

local function activeAccount(src, wanted)
    local identity = Identity.get(src)
    if not identity then return nil end

    local rows = accountsFor(identity.owner)
    if #rows == 0 then return nil end

    if wanted then
        for _, row in ipairs(rows) do
            if row.id == wanted then return row end
        end
    end

    return rows[1]
end

lib.callback.register('royal-phone:server:li:getData', function(src)
    local identity = Identity.get(src)
    if not identity then return nil end

    local accounts = accountsFor(identity.owner)
    local account = accounts[1]

    local posts = MySQL.query.await([[
        SELECT p.id, p.text, p.media, UNIX_TIMESTAMP(p.created_at) * 1000 AS createdAt,
               a.handle, a.name, a.avatar,
               (SELECT COUNT(*) FROM royal_phone_li_likes l WHERE l.post = p.id) AS likes,
               (SELECT COUNT(*) FROM royal_phone_li_comments c WHERE c.post = p.id) AS commentCount
        FROM royal_phone_li_posts p
        JOIN royal_phone_li_accounts a ON a.id = p.account
        WHERE p.kind = 'post'
        ORDER BY p.created_at DESC
        LIMIT 100
    ]]) or {}

    local comments = MySQL.query.await([[
        SELECT c.id, c.post, c.text, UNIX_TIMESTAMP(c.created_at) * 1000 AS createdAt,
               a.handle, a.name
        FROM royal_phone_li_comments c
        JOIN royal_phone_li_accounts a ON a.id = c.account
        ORDER BY c.created_at ASC
        LIMIT 500
    ]]) or {}

    local byPost = {}
    for _, row in ipairs(comments) do
        byPost[row.post] = byPost[row.post] or {}
        table.insert(byPost[row.post], row)
    end

    local liked = {}
    if account then
        local rows = MySQL.query.await(
            'SELECT post FROM royal_phone_li_likes WHERE account = ?', { account.id }
        ) or {}
        for _, row in ipairs(rows) do liked[row.post] = true end
    end

    for _, post in ipairs(posts) do
        post.comments = byPost[post.id] or {}
        post.liked = liked[post.id] or false
        post.reposts = 0
    end

    local stories = MySQL.query.await([[
        SELECT p.id, p.media, UNIX_TIMESTAMP(p.created_at) * 1000 AS createdAt,
               a.handle, a.name, a.avatar
        FROM royal_phone_li_posts p
        JOIN royal_phone_li_accounts a ON a.id = p.account
        WHERE p.kind = 'story' AND p.created_at > (NOW() - INTERVAL 1 DAY)
        ORDER BY p.created_at DESC
    ]]) or {}

    local listings = MySQL.query.await([[
        SELECT l.id, l.title, l.price, l.body, l.media, UNIX_TIMESTAMP(l.created_at) * 1000 AS createdAt,
               a.handle, a.name AS seller
        FROM royal_phone_li_listings l
        JOIN royal_phone_li_accounts a ON a.id = l.account
        ORDER BY l.created_at DESC
        LIMIT 100
    ]]) or {}

    local following, blocked = {}, {}
    if account then
        local rows = MySQL.query.await(
            'SELECT handle, blocked FROM royal_phone_li_follows WHERE account = ?', { account.id }
        ) or {}

        for _, row in ipairs(rows) do
            if isTrue(row.blocked) then blocked[#blocked + 1] = row.handle
            else following[#following + 1] = row.handle end
        end
    end

    local people = MySQL.query.await([[
        SELECT a.handle, a.name, a.avatar, a.bio,
               (SELECT COUNT(*) FROM royal_phone_li_posts p WHERE p.account = a.id AND p.kind = 'post') AS posts,
               (SELECT COUNT(*) FROM royal_phone_li_follows f WHERE f.handle = a.handle AND f.blocked = 0) AS followers
        FROM royal_phone_li_accounts a
        ORDER BY followers DESC, a.id ASC
        LIMIT 200
    ]]) or {}

    local notifications = {}
    if account then
        notifications = MySQL.query.await([[
            SELECT n.id, n.kind, n.post, n.text, n.read, UNIX_TIMESTAMP(n.created_at) * 1000 AS createdAt,
                   a.handle, a.name, a.avatar
            FROM royal_phone_li_notifications n
            JOIN royal_phone_li_accounts a ON a.id = n.actor
            WHERE n.account = ?
            ORDER BY n.created_at DESC
            LIMIT 60
        ]], { account.id }) or {}

        for _, row in ipairs(notifications) do
            row.read = isTrue(row.read)
        end
    end

    return {
        accounts = accounts,
        account = account and account.id or nil,
        posts = posts,
        stories = stories,
        listings = listings,
        following = following,
        blocked = blocked,
        people = people,
        notifications = notifications,
    }
end)

local function bumpFeed()
    TriggerClientEvent('royal-phone:client:li:refresh', -1)
end

---@param postId number
---@param actor table the account acting
---@param kind 'like'|'comment'|'follow'
---@param text? string
local function notifyOwner(postId, actor, kind, text)
    local owner = MySQL.scalar.await('SELECT account FROM royal_phone_li_posts WHERE id = ? LIMIT 1', { postId })
    if not owner or owner == actor.id then return end

    MySQL.insert('INSERT INTO royal_phone_li_notifications (account, actor, kind, post, text) VALUES (?, ?, ?, ?, ?)', {
        owner, actor.id, kind, postId, text and tostring(text):sub(1, 120) or nil,
    })

    local identifier = MySQL.scalar.await(
        'SELECT identifier FROM royal_phone_li_accounts WHERE id = ? LIMIT 1', { owner }
    )
    if not identifier then return end

    local target = Identity.sourcesForOwner(identifier)[1]
    if not target then return end

    TriggerClientEvent('royal-phone:client:notify', target, {
        app = 'lifeinvader',
        title = ('@%s'):format(actor.handle),
        content = kind == 'like' and 'liked your post' or ('commented: %s'):format(text or ''),
        sound = true,
    })
end

lib.callback.register('royal-phone:server:li:createAccount', function(src, data)
    local identity = Identity.get(src)
    if not identity or type(data) ~= 'table' then return false end

    local handle = tostring(data.handle or ''):lower():gsub('[^a-z0-9_.]', ''):sub(1, 20)
    local name = tostring(data.name or ''):sub(1, 32)
    if handle == '' or name == '' then return false end

    local taken = MySQL.scalar.await(
        'SELECT 1 FROM royal_phone_li_accounts WHERE handle = ? LIMIT 1', { handle }
    )
    if taken then return { error = 'handle_taken' } end

    local id = MySQL.insert.await(
        'INSERT INTO royal_phone_li_accounts (identifier, handle, name, avatar, bio) VALUES (?, ?, ?, ?, ?)',
        { identity.owner, handle, name, data.avatar, tostring(data.bio or ''):sub(1, 160) }
    )

    bumpFeed()

    return { id = id }
end)

RegisterNetEvent('royal-phone:server:li:updateAccount', function(data)
    local account = activeAccount(source, data and data.id)
    if not account then return end

    MySQL.update('UPDATE royal_phone_li_accounts SET name = ?, avatar = ?, bio = ? WHERE id = ?', {
        data.name and tostring(data.name):sub(1, 32) or account.name,
        data.avatar ~= nil and data.avatar or account.avatar,
        data.bio and tostring(data.bio):sub(1, 160) or account.bio,
        account.id,
    })
end)

lib.callback.register('royal-phone:server:li:post', function(src, data)
    local account = activeAccount(src)
    if not account or type(data) ~= 'table' then return false end

    local text = tostring(data.text or ''):sub(1, 280)
    if text == '' and not data.media then return false end

    local id = MySQL.insert.await(
        'INSERT INTO royal_phone_li_posts (account, text, media, kind) VALUES (?, ?, ?, ?)',
        { account.id, text, data.media, data.kind == 'story' and 'story' or 'post' }
    )

    bumpFeed()

    return { id = id }
end)

RegisterNetEvent('royal-phone:server:li:like', function(id)
    local account = activeAccount(source)
    if not account or not id then return end

    local liked = MySQL.scalar.await(
        'SELECT 1 FROM royal_phone_li_likes WHERE post = ? AND account = ?', { id, account.id }
    )

    if liked then
        MySQL.update('DELETE FROM royal_phone_li_likes WHERE post = ? AND account = ?', { id, account.id })
    else
        MySQL.insert('INSERT IGNORE INTO royal_phone_li_likes (post, account) VALUES (?, ?)', { id, account.id })
        notifyOwner(id, account, 'like')
    end

    bumpFeed()
end)

RegisterNetEvent('royal-phone:server:li:comment', function(id, text)
    local account = activeAccount(source)
    if not account or not id or type(text) ~= 'string' then return end

    text = text:sub(1, 280)
    if text == '' then return end

    MySQL.insert('INSERT INTO royal_phone_li_comments (post, account, text) VALUES (?, ?, ?)', {
        id, account.id, text,
    })

    notifyOwner(id, account, 'comment', text)
    bumpFeed()
end)

RegisterNetEvent('royal-phone:server:li:follow', function(handle, blocked)
    local account = activeAccount(source)
    if not account or type(handle) ~= 'string' then return end

    local existing = MySQL.scalar.await(
        'SELECT blocked FROM royal_phone_li_follows WHERE account = ? AND handle = ?',
        { account.id, handle }
    )

    if existing ~= nil and (not blocked) == (not isTrue(existing)) then
        MySQL.update('DELETE FROM royal_phone_li_follows WHERE account = ? AND handle = ?', {
            account.id, handle,
        })
        bumpFeed()
        return
    end

    MySQL.insert([[
        INSERT INTO royal_phone_li_follows (account, handle, blocked) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE blocked = VALUES(blocked)
    ]], { account.id, handle, blocked and 1 or 0 })

    if not blocked then
        local followed = MySQL.single.await(
            'SELECT id, identifier FROM royal_phone_li_accounts WHERE handle = ? LIMIT 1', { handle }
        )

        if followed and followed.id ~= account.id then
            MySQL.insert('INSERT INTO royal_phone_li_notifications (account, actor, kind) VALUES (?, ?, ?)', {
                followed.id, account.id, 'follow',
            })

            local target = Identity.sourcesForOwner(followed.identifier)[1]

            if target then
                TriggerClientEvent('royal-phone:client:notify', target, {
                    app = 'lifeinvader',
                    title = ('@%s'):format(account.handle),
                    content = 'started following you',
                    sound = true,
                })
            end
        end
    end

    bumpFeed()
end)

RegisterNetEvent('royal-phone:server:li:readNotifications', function()
    local account = activeAccount(source)
    if not account then return end

    MySQL.update('UPDATE royal_phone_li_notifications SET `read` = 1 WHERE account = ?', { account.id })
end)

lib.callback.register('royal-phone:server:li:list', function(src, data)
    local account = activeAccount(src)
    if not account or type(data) ~= 'table' then return false end

    local title = tostring(data.title or ''):sub(1, 64)
    if title == '' then return false end

    local id = MySQL.insert.await(
        'INSERT INTO royal_phone_li_listings (account, title, price, body, media) VALUES (?, ?, ?, ?, ?)',
        { account.id, title, math.floor(tonumber(data.price) or 0), tostring(data.body or ''):sub(1, 280), data.media }
    )

    bumpFeed()

    return { id = id }
end)

RegisterNetEvent('royal-phone:server:li:removeListing', function(id)
    local account = activeAccount(source)
    if not account or not id then return end

    MySQL.update('DELETE FROM royal_phone_li_listings WHERE id = ? AND account = ?', { id, account.id })
    bumpFeed()
end)

