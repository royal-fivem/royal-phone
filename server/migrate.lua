local SCHEMA_FILE = 'sql/royal-phone.sql'

---@param name string
---@return boolean
local function tableExists(name)
    return MySQL.scalar.await([[
        SELECT 1 FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1
    ]], { name }) ~= nil
end

---@param tbl string
---@param column string
---@return boolean
local function columnExists(tbl, column)
    return MySQL.scalar.await([[
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1
    ]], { tbl, column }) ~= nil
end

---@param tbl string
---@param column string
---@param definition string
local function addColumn(tbl, column, definition)
    if not tableExists(tbl) then return end
    if columnExists(tbl, column) then return end

    MySQL.query.await(('ALTER TABLE `%s` ADD COLUMN `%s` %s'):format(tbl, column, definition))
    print(('^2[royal-phone]^7 added %s.%s'):format(tbl, column))
end

---@param tbl string
---@param column string
---@param definition string
local function modifyColumn(tbl, column, definition)
    if not tableExists(tbl) then return end
    if not columnExists(tbl, column) then return end

    local current = MySQL.scalar.await([[
        SELECT DATA_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1
    ]], { tbl, column })

    if current and current:lower() == definition:lower():match('^(%a+)') then return end

    MySQL.query.await(('ALTER TABLE `%s` MODIFY COLUMN `%s` %s'):format(tbl, column, definition))
    print(('^2[royal-phone]^7 widened %s.%s'):format(tbl, column))
end

---@param sql string
---@return string[]
local function statements(sql)
    local out = {}

    sql = sql:gsub('%-%-[^\n]*', '')

    for chunk in sql:gmatch('[^;]+') do
        local trimmed = chunk:gsub('^%s+', ''):gsub('%s+$', '')
        if trimmed ~= '' then out[#out + 1] = trimmed end
    end

    return out
end

CreateThread(function()
    local sql = LoadResourceFile(GetCurrentResourceName(), SCHEMA_FILE)

    if not sql then
        print(('^1[royal-phone]^7 %s is missing — cannot set up the database.'):format(SCHEMA_FILE))
        return
    end

    local created = 0

    for _, statement in ipairs(statements(sql)) do
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

    addColumn('royal_phone_bank_invoices', 'paid_at', 'TIMESTAMP NULL DEFAULT NULL')
    addColumn('royal_phone_bank_invoices', 'declined', 'TINYINT(1) NOT NULL DEFAULT 0')
    addColumn('royal_phone_bank_invoices', 'declined_at', 'TIMESTAMP NULL DEFAULT NULL')
    addColumn('royal_phone_bank_invoices', 'can_decline', 'TINYINT(1) NOT NULL DEFAULT 1')

    addColumn('royal_phone_numbers', 'sim', 'VARCHAR(20) DEFAULT NULL')

    addColumn('royal_phone_groups', 'avatar', 'LONGTEXT DEFAULT NULL')

    -- avatars can be a full base64 photo from the gallery, so they need the room
    modifyColumn('royal_phone_contacts', 'avatar', 'LONGTEXT DEFAULT NULL')
    modifyColumn('royal_phone_groups', 'avatar', 'LONGTEXT DEFAULT NULL')
    modifyColumn('royal_phone_li_accounts', 'avatar', 'LONGTEXT DEFAULT NULL')

    addColumn('royal_phone_messages', 'kind', "VARCHAR(12) NOT NULL DEFAULT 'text'")
    addColumn('royal_phone_messages', 'media', 'LONGTEXT DEFAULT NULL')
    addColumn('royal_phone_messages', 'seconds', 'SMALLINT UNSIGNED DEFAULT NULL')
    addColumn('royal_phone_messages', 'location', 'VARCHAR(255) DEFAULT NULL')

    addColumn('royal_phone_documents', 'signable', 'TINYINT(1) NOT NULL DEFAULT 0')

    addColumn('royal_phone_li_accounts', 'active', 'TINYINT(1) NOT NULL DEFAULT 0')

    if tableExists('royal_phone_group_members') and columnExists('royal_phone_groups', 'members') then
        local migrated = MySQL.scalar.await('SELECT COUNT(*) FROM royal_phone_group_members') or 0

        if migrated == 0 then
            local rows = MySQL.query.await('SELECT id, identifier, members FROM royal_phone_groups') or {}
            local moved = 0

            for _, row in ipairs(rows) do
                local members = json.decode(row.members or '[]')

                if type(members) == 'table' then
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

    TriggerEvent('royal-phone:server:databaseReady')
end)

