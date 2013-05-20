var path = require('path');

exports.up = function (next) {
  query('CREATE DATABASE IF NOT EXISTS [db] CHARACTER SET latin1 COLLATE latin1_general_cs', next);
};

exports.down = function (next) {
  query('DROP DATABASE IF EXISTS [db]', next);
};

// We can't use the sql or task helpers because the database does not exist yet.
function query (sql, next) {
  delete require.cache[require.resolve('cantina')];
  delete require.cache[require.resolve('cantina-mysql')];

  var app = require('cantina');
  app.load(function(err) {
    if (err) throw err;

    var database = app.conf.get('mysql:database');
    app.conf.set('mysql:database', null);

    require(app.root + '/plugins/utils');
    require('cantina-mysql');

    app.init(function(err) {
      if (err) throw err;

      app.mysql.query(sql.replace('[db]', database), function(err) {
        if (err) throw err;

        app.utils.clearRequireCache();
        next();
      });
    });
  });
}