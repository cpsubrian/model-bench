CREATE TABLE IF NOT EXISTS `players` (

    `id`            VARCHAR(16)       NOT NULL
  , `first`    VARCHAR(255)      CHARACTER SET utf8 COLLATE utf8_general_ci
  , `last`     VARCHAR(255)      CHARACTER SET utf8 COLLATE utf8_general_ci
  , `team`          VARCHAR(40)
  , `position`      VARCHAR(40)
  , `created`       DATETIME          NOT NULL
  , `updated`       DATETIME          NOT NULL

  , PRIMARY KEY (`id`)
  , INDEX team (`team`)

) ENGINE=InnoDB