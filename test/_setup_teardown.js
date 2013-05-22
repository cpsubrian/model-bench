/**
 * Setup and teardown for the whole test run.
 */

// Create master test db.
before(function (done) {
  master_conf = testConf();
  setupTestDB(master_conf, function (err, conf) {
    if (err) return done(err);
    done();
  });
});

// Destroy master test db.
after(function (done) {
  destroyTestDB(master_conf, done);
});