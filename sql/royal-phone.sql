CREATE TABLE IF NOT EXISTS `royal_phone_numbers` (
    `identifier` VARCHAR(64) NOT NULL,
    `number` VARCHAR(24) NOT NULL,
    PRIMARY KEY (`identifier`),
    UNIQUE KEY `number` (`number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_contacts` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `identifier` VARCHAR(64) NOT NULL,
    `name` VARCHAR(48) NOT NULL,
    `number` VARCHAR(24) NOT NULL,
    `avatar` VARCHAR(255) DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_messages` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sender` VARCHAR(24) NOT NULL,
    `receiver` VARCHAR(24) NOT NULL,
    `content` TEXT NOT NULL,
    `read` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `sender` (`sender`),
    KEY `receiver` (`receiver`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_calls` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `caller` VARCHAR(24) NOT NULL,
    `receiver` VARCHAR(24) NOT NULL,
    `answered` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `caller` (`caller`),
    KEY `receiver` (`receiver`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_groups` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `identifier` VARCHAR(64) NOT NULL,
    `name` VARCHAR(48) NOT NULL,
    `members` TEXT NOT NULL,
    PRIMARY KEY (`id`),
    KEY `identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_li_accounts` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `identifier` VARCHAR(64) NOT NULL,
    `handle` VARCHAR(20) NOT NULL,
    `name` VARCHAR(32) NOT NULL,
    `avatar` TEXT DEFAULT NULL,
    `bio` VARCHAR(160) NOT NULL DEFAULT '',
    `active` TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `handle` (`handle`),
    KEY `identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_li_posts` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `account` INT UNSIGNED NOT NULL,
    `text` VARCHAR(280) NOT NULL DEFAULT '',
    `media` TEXT DEFAULT NULL,
    `kind` VARCHAR(12) NOT NULL DEFAULT 'post',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `account` (`account`),
    KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_li_likes` (
    `post` INT UNSIGNED NOT NULL,
    `account` INT UNSIGNED NOT NULL,
    PRIMARY KEY (`post`, `account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_li_reposts` (
    `post` INT UNSIGNED NOT NULL,
    `account` INT UNSIGNED NOT NULL,
    PRIMARY KEY (`post`, `account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_li_comments` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `post` INT UNSIGNED NOT NULL,
    `account` INT UNSIGNED NOT NULL,
    `text` VARCHAR(280) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `post` (`post`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_li_follows` (
    `account` INT UNSIGNED NOT NULL,
    `handle` VARCHAR(20) NOT NULL,
    `blocked` TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (`account`, `handle`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_li_listings` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `account` INT UNSIGNED NOT NULL,
    `title` VARCHAR(64) NOT NULL,
    `price` INT NOT NULL DEFAULT 0,
    `body` VARCHAR(280) NOT NULL DEFAULT '',
    `media` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `account` (`account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_notes` (
    `identifier` VARCHAR(64) NOT NULL,
    `notes` LONGTEXT NOT NULL,
    PRIMARY KEY (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_documents` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `identifier` VARCHAR(64) NOT NULL,
    `title` VARCHAR(64) NOT NULL DEFAULT 'Untitled document',
    `banner` VARCHAR(16) NOT NULL DEFAULT 'slate',
    `body` LONGTEXT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_document_shares` (
    `document` INT UNSIGNED NOT NULL,
    `identifier` VARCHAR(64) NOT NULL,
    `number` VARCHAR(24) NOT NULL,
    `name` VARCHAR(48) NOT NULL DEFAULT '',
    `can_edit` TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (`document`, `identifier`),
    KEY `identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_li_notifications` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `account` INT UNSIGNED NOT NULL,
    `actor` INT UNSIGNED NOT NULL,
    `kind` VARCHAR(12) NOT NULL,
    `post` INT UNSIGNED DEFAULT NULL,
    `text` VARCHAR(120) DEFAULT NULL,
    `read` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `account` (`account`),
    KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_bank_transactions` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `identifier` VARCHAR(64) NOT NULL,
    `label` VARCHAR(64) NOT NULL,
    `amount` INT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `identifier` (`identifier`),
    KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_bank_pending` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `identifier` VARCHAR(64) NOT NULL,
    `amount` INT NOT NULL,
    `label` VARCHAR(64) NOT NULL DEFAULT '',
    PRIMARY KEY (`id`),
    KEY `identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_sims` (
    `serial` VARCHAR(20) NOT NULL,
    `identifier` VARCHAR(64) NOT NULL,
    `number` VARCHAR(24) NOT NULL,
    `label` VARCHAR(48) NOT NULL DEFAULT '',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`serial`),
    UNIQUE KEY `number` (`number`),
    KEY `identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_group_members` (
    `group_id` INT UNSIGNED NOT NULL,
    `identifier` VARCHAR(64) NOT NULL,
    `number` VARCHAR(24) NOT NULL,
    `last_read` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `joined_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`group_id`, `identifier`),
    KEY `identifier` (`identifier`),
    KEY `number` (`number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_photos` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `identifier` VARCHAR(64) NOT NULL,
    `data` LONGTEXT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `royal_phone_document_signatures` (
    `document` INT UNSIGNED NOT NULL,
    `identifier` VARCHAR(64) NOT NULL,
    `name` VARCHAR(48) NOT NULL DEFAULT '',
    `number` VARCHAR(24) NOT NULL DEFAULT '',
    `signed_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`document`, `identifier`),
    KEY `document` (`document`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
