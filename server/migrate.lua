--- Schema migration, run on every resource start.
---
--- The point is that you never run a .sql file by hand again: whatever the
--- resource needs, it creates. `sql/royal-phone.sql` is the single source of
--- truth and every statement in it is written to be safe to run twice —
--- `CREATE TABLE IF NOT EXISTS`, and column changes go through the helpers below
--- rather than a bare ALTER.
---
--- Cost is one pass at startup and nothing afterwards.

local SCHEMA_FILE = 'sql/royal-phone.sql'

--#region helpers

---Does this table exist in the current schema?
---@param name string
---@return boolean
local function tableExists(name)
    return MySQL.scalar.await([[
        SELECT 1 FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1
    ]], { name }) ~= nil
end

---Does this column exist?
---@param tbl string
---@param column string
---@return boolean
local function columnExists(tbl, column)
    return MySQL.scalar.await([[
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1
    ]], { tbl, column }) ~= nil
end

---Add a column only if it is missing. MySQL has no `ADD COLUMN IF NOT EXISTS`
---before 8.0.29 and MariaDB's syntax differs, so this is checked rather than
---attempted-and-ignored — a swallowed error hides real failures too.
---@param tbl string
---@param column string
---@param definition string
local function addColumn(tbl, column, definition)
    if not tableExists(tbl) then return end
    if columnExists(tbl, column) then return end

    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN `%s` %s'):format(tbl, column, definition))
    print(('^2[royal-phone]^7 added %s.%s'):format(tbl, column))
end

---Split a .sql file into statements.
---
---Naive on purpose: the schema file is ours, contains no stored procedures and no
---semicolons inside string literals, so splitting on `;` is correct here and a
---real parser would be dead weight.
---@param sql string
---@return string[]
local function statements(sql)
    local out = {}

    -- Strip line comments first, otherwise a `--` before a `;` eats the split.
    sql = sql:gsub('%-%-[^\n]*', '')

    for chunk in sql:gmatch('[^;]+') do
        local trimmed = chunk:gsub('^%s+', ''):gsub('%s+$', '')
        if trimmed ~= '' then out[#out + 1] = trimmed end
    end

    return out
end

--#endregion

--#region run

CreateThread(function()
    local sql = LoadResourceFile(GetCurrentResourceName(), SCHEMA_FILE)

    if not sql then
        print(('^1[royal-phone]^7 %s is missing — cannot set up the database.'):format(SCHEMA_FILE))
        return
    end

    local created = 0

    for _, statement in ipairs(statements(sql)) do
        -- Only CREATE TABLE IF NOT EXISTS is expected here. Anything else in the
        -- file is a mistake worth shouting about rather than running blind.
        if statement:upper():find('^CREATE TABLE IF NOT EXISTS') then
            local name = statement:match('`([%w_]+)`')
            local isNew = name and not tableExists(name)

            MySQL.query.await(statement)

            if isNew then
                created += 1
                print(('^2[royal-phone]^7 created table %s'):format(name))
            end
        else
            print(('^3[royal-phone]^7 skipped a non-CREATE statement in %s'):format(SCHEMA_FILE))
        end
    end

    --------------------------------------------------------------------------
    -- Column migrations for servers that ran an earlier version.
    --
    -- Add to this list when a column is introduced; it is a no-op once applied,
    -- so it is safe to leave in place forever.
    --------------------------------------------------------------------------

    -- SIM cards: identity moved from the character to the card, and the numbers
    -- table gained the serial that owns each number.
    addColumn('royal_phone_numbers', 'sim', 'VARCHAR(20) DEFAULT NULL')

    -- Groups gained a picture.
    addColumn('royal_phone_groups', 'avatar', 'TEXT DEFAULT NULL')

    -- Messages carry more than text. These were being sent by the client and
    -- read back by the UI, but never stored — so a photo, a voice note or a
    -- shared location survived only until the phone was reopened, at which point
    -- it came back as a bare line of text with nothing attached.
    addColumn('royal_phone_messages', 'kind', "VARCHAR(12) NOT NULL DEFAULT 'text'")
    addColumn('royal_phone_messages', 'media', 'LONGTEXT DEFAULT NULL')
    addColumn('royal_phone_messages', 'seconds', 'SMALLINT UNSIGNED DEFAULT NULL')
    addColumn('royal_phone_messages', 'location', 'VARCHAR(255) DEFAULT NULL')

    -- Documents that need signing.
    addColumn('royal_phone_documents', 'signable', 'TINYINT(1) NOT NULL DEFAULT 0')

    --------------------------------------------------------------------------
    -- Membership moved out of the owner's JSON blob and into its own table.
    --
    -- The old shape stored the member list only on the owner's row, which meant
    -- nobody else's phone could see the group at all — and group messages were
    -- filed under a key none of them queried. Backfilled once, then the old
    -- column is left alone as a record of what was there.
    --------------------------------------------------------------------------
    if tableExists('royal_phone_group_members') and columnExists('royal_phone_groups', 'members') then
        local migrated = MySQL.scalar.await('SELECT COUNT(*) FROM royal_phone_group_members') or 0

        if migrated == 0 then
            local rows = MySQL.query.await('SELECT id, identifier, members FROM royal_phone_groups') or {}
            local moved = 0

            for _, row in ipairs(rows) do
                local ok, members = pcall(json.decode, row.members or '[]')

                if ok and type(members) == 'table' then
                    -- The owner is a member of their own group; older rows never
                    -- listed them because the row itself implied it.
                    local ownerNumber = MySQL.scalar.await(
                        'SELECT number FROM royal_phone_numbers WHERE identifier = ? LIMIT 1', { row.identifier }
                    )

                    if ownerNumber then
                        MySQL.insert.await([[
                            INSERT IGNORE INTO royal_phone_group_members (group_id, identifier, number)
                            VALUES (?, ?, ?)
                        ]], { row.id, row.identifier, ownerNumber })
                        moved += 1
                    end

                    for _, number in ipairs(members) do
                        local identifier = MySQL.scalar.await(
                            'SELECT identifier FROM royal_phone_numbers WHERE number = ? LIMIT 1', { number }
                        )

                        if identifier then
                            MySQL.insert.await([[
                                INSERT IGNORE INTO royal_phone_group_members (group_id, identifier, number)
                                VALUES (?, ?, ?)
                            ]], { row.id, identifier, number })
                            moved += 1
                        end
                    end
                end
            end

            if moved > 0 then
                print(('^2[royal-phone]^7 moved %d group memberships into royal_phone_group_members.'):format(moved))
            end
        end
    end

    if created > 0 then
        print(('^2[royal-phone]^7 database ready (%d new table%s).'):format(created, created == 1 and '' or 's'))
    end

    -- Let the rest of the server scripts know it is safe to query.
    TriggerEvent('royal-phone:server:databaseReady')
end)

--#endregion
