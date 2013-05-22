var app = require('cantina');

require(app.root + '/plugins/model');

/**
 * User model.
 */
var Player = app.model.Model.extend({
  type: 'player',
  table: 'players',
  key: ['id'],
  schema: {
    id: {
      type: String,
      writable: false,
      required: true,
      validators: [app.validators.isId],
      default: function () {
        return idgen(16);
      }
    },
    first: {
      required: true,
      validators: [app.validators.isType('string')],
      default: ''
    },
    last: {
      required: true,
      validators: [app.validators.isType('string')],
      default: ''
    },
    team: {
      required: true,
      validators: [app.validators.isType('string')]
    },
    position: {
      required: true,
      validators: [app.validators.matches(/^(QB|WR|RB)$/)]
    },
    created: {
      type: String,
      required: true,
      validators: [app.validators.isDate],
      default: function () {
        return tz(new Date(), 'UTC', '%F %T');
      }
    },
    updated: {
      type: String,
      required: true,
      validators: [app.validators.isDate],
      prepare: function () {
        return tz(new Date(), 'UTC', '%F %T');
      }
    }
  }
});

module.exports = Player;