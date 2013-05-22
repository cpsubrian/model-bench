#!/usr/bin/env node

var app = require('cantina');

// Setup.
app.load(function(err) {
  if (err) throw err;

  require('cantina-mysql');

  app.init(function (err) {
    if (err) throw err;

    // Run the tests.
    require('bench').runMain();
  });
});


// The tests.
exports.compare = {
  'model classes': function (done) {
    setTimeout(done, 300);
  },
  'obj literals': function (done) {
    setTimeout(done, 300);
  }
};