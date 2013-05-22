assert = require('assert');
util = require('util');
idgen = require('idgen');
exec = require('child_process').exec;
path = require('path');
_ = require('underscore');
rimraf = require('rimraf');
ncp = require('ncp').ncp;
fs = require('fs');
master_conf = null;
port = 9000;

testUrl = function (path) {
  return 'http://localhost:' + port + '/' + path;
};

/**
 * Set up an application with test config and a test database.
 */
createTestApp = function (cb) {
  var app = require('cantina');
  setupTestEnvironment(function (err, conf) {
    if (err) return cb(err);
    app.load(function(err) {
      if (err) return cb(err);

      // Test config.
      app.conf.unshift(conf);

      // Custom jog store, just discards log entries.
      app.on('log:store', function () {
        return {
          add: function () {

          },
          clear: function (cb) {
            process.nextTick(cb);
          }
        };
      });

      // Load minimum app plugins.
      require('../plugins/utils');
      require('cantina-mysql');

      // Destroy an app:
      // - Migrate down to drop database.
      // - Destroy mysql connections.
      // - Clear require cache of all plugins loaded with app.require().
      app.destroy = function(done) {
        destroyTestEnvironment(conf, function (err) {
          if (err) return done(err);

          // Destroy mysql connections.
          if (app.mysql && app.mysql.connections) {
            app.mysql.connections.forEach(function(connection) {
              connection.destroy();
            });
          }

          // Clear require cache.
          app.utils.clearRequireCache();

          done();
        });
      };

      cb();
    });
  });
  return app;
};

/**
 * Setup the test environment:
 * - Create a test database.
 * - Run migrations on that database.
 *
 * Callback called with (err, conf);
 */
setupTestEnvironment = function (cb) {
  var conf = testConf();
  cloneDB(master_conf.name, conf.name, function (err) {
    cb(err, conf);
  });
};

/**
 * Clone a database.
 */
cloneDB = function (from, to, cb) {
  var sql = "CREATE DATABASE IF NOT EXISTS " + to + " CHARACTER SET latin1 COLLATE latin1_general_cs";
  exec('mysql -u root -e "' + sql + '"', function (err, stdout, stderr) {
    if (err) {
      console.error(stderr);
      return cb(err);
    }
    exec('mysqldump -u root ' + from + ' | mysql -u root ' + to, function (err, stdout, stderr) {
      if (err) {
        console.error(stderr);
        cb(err);
      }
      else {
        cb();
      }
    });
  });
};

/**
 * Drop a database.
 */
dropDB = function (name, cb) {
  exec('mysql -u root -e "DROP DATABASE ' + name + '"', function (err, stdout, stderr) {
    if (err) {
      console.error(stderr);
      cb(err);
    }
    else {
      cb(err);
    }
  });
};

/**
 * Destroy a test environment.
 */
destroyTestEnvironment = function (conf, cb) {
  // Drop database.
  dropDB(conf.name, cb);
};

testConf = function () {
  var name = 'model_bench_test_' + idgen().toLowerCase();
  var conf = {
    test: true,
    name: name,
    mysql: {
      host: 'localhost',
      port: 3306,
      user: 'root',
      database: name
    }
  };
  return conf;
};

/**
 * Convert a conf object to an etc compatible env object.
 */
confToEnv = function (conf, env, prefix) {
  env = env || _.clone(process.env);
  prefix = prefix || 'app_';

  Object.keys(conf).forEach(function(key) {
    if (typeof conf[key] === 'object') {
      confToEnv(conf[key], env, prefix + key + ':');
    }
    else {
      env[prefix + key] = conf[key];
    }
  });

  return env;
};
/**
 * Setup master test db.
 */
setupTestDB = function (conf, cb) {
  // Delete test/migrations.
  rimraf.sync(path.join(__dirname, 'migrations'));

  // Copy migrations to test dir.
  ncp(path.resolve(__dirname, '../migrations'), path.join(__dirname, 'migrations'), function (err) {
    if (err) return cb(err);

    // Delete .migrate file.
    var migPath = path.join(__dirname, 'migrations/.migrate');
    if (fs.existsSync(migPath)) {
      fs.unlinkSync(migPath);
    }

    // Run migrations up.
    var cmd = 'node ' + path.resolve(__dirname, '../node_modules/.bin/migrate');
    exec(cmd, {cwd: __dirname, env: confToEnv(conf)}, cb);
  });
};

/**
 * Destroy a test db.
 */
destroyTestDB = function (conf, cb) {
  // Run migrations down.
  var cmd = 'node ' + path.resolve(__dirname, '../node_modules/.bin/migrate') + ' down';
  exec(cmd, {cwd: __dirname, env: confToEnv(conf)}, function (err, stdio, stderr) {
    if (err) return cb(err);

    // Delete test/migrations.
    rimraf.sync(path.join(__dirname, 'migrations'));

    cb();
  });
};
