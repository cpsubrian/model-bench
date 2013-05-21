var sql = require('./helpers/sql')
  , task = require('./helpers/task');

exports.up = sql('sql/002-create-players.sql');

exports.down = task(function (app, next) {
  app.mysql.query('DROP TABLE IF EXISTS `players`', next);
});