var app = require('cantina')
  , fs = require('fs')
  , path = require('path')
  , task = require('./task');

module.exports = function (filename) {
  filename = path.resolve(app.root, 'migrations', filename);
  return task(function sql (app, next) {
    if (fs.existsSync(filename)) {
      fs.readFile(filename, 'utf8', function (err, data) {
        if (err) throw err;
        app.mysql.query(data, function(err) {
          if (err) throw err;

          // Destroy mysql connections.
          if (app.mysql && app.mysql.connections) {
            app.mysql.connections.forEach(function(connection) {
              connection.destroy();
            });
          }

          // Clear require cache.
          app.utils.clearRequireCache();

          process.nextTick(function (){
            // Shut down http server.
            if (app.http) {
              app.http.close(next);
            }
            else {
              next();
            }
          });
        });
      });
    }
    else {
      throw new Error('Could not find ' + filename);
    }
  });
};