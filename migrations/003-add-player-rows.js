var sql = require('./helpers/sql')
  , task = require('./helpers/task');

exports.up = sql('sql/003-add-player-rows.sql');

exports.down = task(function (app, next) {
  app.mysql.query('TRUNCATE TABLE `players`', next);
});