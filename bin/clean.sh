#!/usr/bin/env node

/**
 * Clean-up left-over test databases and test/migrations folder.
 */

var app = require('cantina'),
  path = require('path'),
  fs = require('fs');
  rimraf = require('rimraf');

require('colors');
console.log('');

var bullet = '• '.grey,
  check = '   ✓ '.green;

app.load(function(err) {
  if (err) throw err;

  app.conf.set('mysql:database', null);
  require('cantina-mysql');

  app.init(function (err) {
    if (err) throw err;

    app.utils.async.series([

      // Drop test databases.
      function (next) {
        console.log(bullet + 'Dropping test databases');
        app.mysql.query("SHOW DATABASES", function (err, results) {
          if (err) return next(err);

          var tasks = [];
          results.forEach(function (row) {
            if (row.Database && row.Database.match(/^model_bench_test_/)) {
              tasks.push(function (done) {
                app.mysql.query("DROP DATABASE " + row.Database, function (err) {
                  if (err) {
                    console.log(check.red + row.Database.grey);
                  }
                  else {
                    console.log(check + row.Database.grey);
                  }
                  done(err);
                });
              });
            }
          });

          if (tasks.length) {
            app.utils.async.series(tasks, next);
          }
          else {
            next();
          }
        });
      },

      // Remove test/migrations.
      function (next) {
        console.log(bullet + 'Removing ./test/migrations');

        var migrationsPath = path.resolve(__dirname, '../test/migrations');
        if (fs.existsSync(migrationsPath)) {
          rimraf(migrationsPath, function (err) {
            if (err) {
              console.log(check + 'Removed ./test/migrations'.grey);
            }
            else {
              console.log(check.red + 'Removed ./test/migrations'.grey);
            }
            next(err);
          });
        }
        else {
          next();
        }
      },

    ], function (err) {
      if (err) {
        console.error(err);
      }
      else {
        console.log('✓ '.green + 'All clean' + "\n");
      }
      process.exit();
    });
  });
});