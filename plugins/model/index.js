var app = require('cantina')
  , _ = require('underscore');

require(app.root + '/plugins/utils');
require(app.root + '/plugins/validators');

app.model = {};
app.models = {};

// Base model
require('./model');

// Player model
app.models.player = require('./player');
