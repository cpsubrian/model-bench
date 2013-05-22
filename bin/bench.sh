#!/usr/bin/env node

var app = require('cantina');

// Setup.
app.load(function(err) {
  if (err) throw err;

  require('cantina-mysql');
  require(app.root + '/plugins/model');

  app.init(function (err) {
    if (err) throw err;

    // Run the tests.
    require('bench').runMain();
  });
});


// The tests.
exports.compare = {
  'model classes': function (done) {
    app.models.player.findOne(function (err, player) {
      done(err);
    });
  },
  'obj literals': function (done) {
    app.mysql.query("SELECT * FROM players LIMIT 1", function (err, results) {
      done(err);
    });
  }
};