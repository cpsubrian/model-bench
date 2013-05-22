var app = require('cantina'),
    clone = app.utils.clone,
    extend = app.utils.extend,
    _ = require('underscore');

require('cantina-mysql');

app.model.Model = Model;

/**
 * Model class.
 */
function Model () {
  Model.prototype.constructor.apply(this, arguments);
}

// Auto-prefix "protected" properties before sending to app.utils.extend().
Model.extend = function (staticProps, protoProps) {
  // prefix properties which are prefixed on the parent object
  function prefixProp (obj, parent) {
    return function (o, k) {
      var origKey = k;
      if (k.charAt(0) !== '_' && typeof parent['_' + k] !== 'undefined' && typeof parent['_' + k] !== 'function') {
        k = '_' + k;
      }
      o[k] = obj[origKey];
      return o;
    };
  }
  if (staticProps) staticProps = Object.keys(staticProps).reduce(prefixProp(staticProps, Model), {});
  if (protoProps) protoProps = Object.keys(protoProps).reduce(prefixProp(protoProps, Model.prototype), {});

  // Allow schema to be an array of mixins.
  if (staticProps._schema && Array.isArray(staticProps._schema)) {
    staticProps._schema = app.utils.defaults.apply(app.utils, [true, {}].concat(staticProps._schema.reverse()));
  }

  if(staticProps._schema) {
    Model.prepareSchema(staticProps._schema);
  }

  return extend.call(this, protoProps, staticProps);
};

Model.prepareSchema = function (schema) {

  Object.keys(schema).forEach(function (column) {
    if (schema[column].alias_for) {
      var realColumn = schema[column].alias_for;

      schema[column].get = function() {
        return this[realColumn];
      };
      schema[column].set = function(val) {
        this[realColumn] = val;
      };
      schema[column].virtual = true;
    }
  });
};

// Models can implement a '_table' static property. It should be the string
// name of the model's primary MySQL table.
Model._table = null;

// Models can implement a '_key' static property. It is an array of the column
// names that make up the model's primary key.
Model._key = null;

// Models should set a '_type' static property. It should be a string and can help
// to identify models in event handlers and other ambiguous senarios.
Model._type = null;

// Models should implement a '_schema' static property.
//
// Example:
//
// ```
// _schema: _.extend({},
//
//   app.model.schemas.id,
//   app.model.schemas.dates, {
//
//   my_column: {
//     required: true,
//     validators: [],
//     default: 'published',
//     prepare: function (val) {
//       return val.toLowerCase();
//     }
//   }
//
//  })
//  ```
//
//  Supported column options (they are all optional):
//
//  - `required`: A model must have a value defined for this column.
//  - `validators`: An array of validation handlers.
//  - `default`: The default value, or a function that returns the default.
//  - `prepare`: A handler to run on the column value before the model is saved.
//  - `virtual`: Identifies this column as NOT part of the database schema.
//  - `get`: A custom getter for this column.
//  - `set`: A custom setter for this column.
//  - `writable`: If `false`, no setter will be defined for the column (the
//     default and constructor args will still be set).
//
Model._schema = {};

/**
 * Find a unique model by its key column(s).
 */
Model.findByKey = function (values, options, cb) {
  var cols = {};
  if (typeof options === 'function'){
    cb = options;
    options = {};
  }

  // Check that the model has a key.
  if (!this._key || !this._key.length) {
    return cb(new Error('Cannot `findByKey()` on a model with no key'));
  }

  // If a primitive was passed, massage it into an object.
  if (typeof values !== 'object') {
    if (this._key.length === 1) {
      cols[this._key[0]] = values;
    }
    else {
      return cb(new Error('Tried to call `findByKey()` with one value on a model with a multi-column key'));
    }
  }
  else {
    cols = values;
  }

  // Ensure values for every key column were provided.
  if (!this._key.every(function (col) { return typeof cols[col] !== 'undefined'; })) {
    return cb(new Error('Missing one or more key values'));
  }
  options = _.extend(options, cols);

  // Find the model.
  this.findOne(options, cb);
};

/**
 * Find and return a single model.
 */
Model.findOne = function (options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }

  options.limit = 1;

  return this.find(options, function (err, models) {
    if (err) return cb(err);
    if (models.length) {
      cb(null, models.pop());
    }
    else {
      cb(null, null);
    }
  });
};

Model.processFindArgs = function (options) {
  options = app.utils.clone(options) || {};

  var parts = {
    from: ["`" + this._table + "` as " + this._table]
  };

  // Instatiate options.
  options.values = options.values || [];

  // There are three possible states of where:
  // - A SQL string.
  // - A hash of key:value combinations.
  // - An array of SQL where strings.
  //
  // We also support passing real column key:value pairs at the root of the
  // options object.
  var whereHash = {};
  if (!options.where) {
    options.where = [];
  }
  else if (typeof options.where === 'string') {
    options.where = [options.where];
  }
  else if (Array.isArray(options.where)) {
    // do nothing.
  }
  else {
    whereHash = options.where;
    options.where = [];
  }

  // Handle real column key:value pairs.
  this._realColumns().forEach(function (col) {
    if (typeof options[col] !== 'undefined') {
      whereHash[col] = options[col];
      delete options[col];
    }
  });

  // Resolve any alias conditions to their real column names.
  this._aliasColumns().forEach(function (col) {
    if(options[col] || whereHash[col]) {
      whereHash[this._schema[col].alias_for] = options[col] || whereHash[col];
      delete whereHash[col];
      delete options[col];
    }
  }, this);

  // Concat where hash onto where array.
  options.where = options.where.concat(this._objConditions(whereHash));
  options.values = options.values.concat(this._objValues(whereHash));

  // Copy over parts from options.
  ['select', 'from', 'join', 'where', 'group', 'order', 'limit', 'offset'].forEach(function (key) {
    if (options[key]) {
      parts[key] = options[key];
    }
  });

  if (options.populate) {
    // Coerce to an array.
    if (!Array.isArray(options.populate)) options.populate = [options.populate];

    // Modify query parts based on populate option.
    this.populateFind(options.populate, parts);
  }

  // Allow sub-classes to alter parts.
  this.alterFind(options, parts);

  // Allow other plugins to alter parts.
  app.emit('model:find:alter', this._type, options, parts);

  return {parts: parts, values: options.values};
};

/**
 * Find models.
 */
Model.find = function (options, cb) {
  var ModelClass = this;

  if (typeof options === 'function') {
    cb = options;
    options = {};
  }

  var args = ModelClass.processFindArgs(options);
  var sql = app.mysql.build(args.parts);
  var values = args.values;

  // Query for the models.
  if (cb) {
    return app.mysql.query({sql: sql, values: values, nestTables: true}, function (err, results) {
      if (err) return cb(err);

      // Convert results to models.
      var models = [];
      results.forEach(function (row) {
        models.push(ModelClass.createFromQuery(row));
      });

      // Allow other plugins to modify loaded models.
      var tasks = [];
      models.forEach(function (model) {
        tasks.push(app.series.bind(app, 'model:load', model));
        model._relatedColumns.forEach(function (col) {
          if (typeof model[col] != 'undefined') {
            tasks.push(app.series.bind(app, 'model:load', model[col]));
          }
        });
      });
      app.utils.async.parallel(tasks, function (err) {
        cb(err, models);
      });
    });
  }
  else {
    var query = app.mysql.query;
    var stream = query({sql: sql, values: values, nestTables: true});

    // Convert results to models.
    stream.on('result', function (row) {
      var model = ModelClass.createFromQuery(row);
      var tasks = [];
      tasks.push(app.series.bind(app, 'model:load', model));
      model._relatedColumns.forEach(function (col) {
        if (typeof model[col] != 'undefined') {
          tasks.push(app.series.bind(app, 'model:load', model[col]));
        }
      });
      app.utils.async.parallel(tasks, function (err) {
        if (err) return app.emit('error', err);
        stream.emit('model', model);
      });
    });

    // Expose pause and resume for convenience.
    stream.pause = (stream._connection || query._connection).pause;
    stream.resume = (stream._connection || query._connection).resume;

    return stream;
  }
};

/**
 * Alter find() options.
 */
Model.alterFind = function (options, parts) {};

/*
 * Modifies query parts to populate related entities
 *  using a JOIN
 */
Model.populateFind = function (populate, parts, self_name) {
  var self = this;
  self_name = self_name || self._table;
  populate.forEach(function (col) {
    if (self._schema[col] && self._schema[col].related){

      var related = self._schema[col].related;

      //Perform a join with the indicated table
      var related_alias = (self_name === self._table ? col : self_name + '.' + col);

      parts.join = parts.join || [];
      var joinStr = " LEFT JOIN `" + related.model._table + "` AS `" + related_alias + "` ON ";

      var conditions = [];
      Object.keys(related.columns).forEach(function (key) {
        var condition = "`" + related_alias + "`.`" + key + "` = ";
        if (related.columns[key].match(/^(\'|\")[^\'\"]+(\'|\")$/)) {
          //append primitive value
          condition += related.columns[key];
        }
        else {
          //prefix column value with table name
          condition += "`" + self_name + "`.`" + related.columns[key] + "`";
        }
        conditions.push(condition);
      });
      joinStr = joinStr.concat(conditions.join(" AND "));
      parts.join.push(joinStr);
    }
    else {
      var nested = col.split('.');
      var outer = nested.shift();
      var rest = nested.join('.');
      if (self._schema[outer] && self._schema[outer].related) {
        var model = self._schema[outer].related.model;
        var nested_self_name = (self_name === self._table ? outer : self_name + '.' + outer);
        model.populateFind([rest], parts, nested_self_name);
      }
    }
  });
};

/*
 * Creates the model from SQL query results
 */
Model.createFromQuery = function (row, self_name) {
  var self = this;
  var values = {};
  self_name = self_name || self._table;

  Object.keys(row).forEach(function (table) {
    //Nested tables in each row may either be ours
    // or belong to a related model from our schema
    if (table === self_name) {
      values = row[table];
    }
    else {
      //Find the related column
      self._relatedColumns().forEach(function (col) {
        var model = self._schema[col].related.model;
        var related_alias = (self_name === self._table ? col : self_name + '.' + col);

        //Only construct related model if row contains at least
        // its primary key
        if (table === related_alias && row[table][model._key[0]]) {
          values[col] = model.createFromQuery(row, related_alias);
        }
      });
    }
  });

  // Unserialize values if necessary
  Object.keys(values).forEach(function (col) {
    if (self._schema[col] && self._schema[col].serialized) {
      try {
        values[col] = JSON.parse(values[col]);
      } catch(err) {}
    }
  });

  return new self(values);
};

// Create and save a model instance from values.
Model.create = function(values, cb) {
  var model = new this(values, true);
  model.save(function (err, results) {
    if (err) cb(err);
    else cb(null, model);
  });
};

// Query for and return models.
Model.query = function (options, cb) {
  var args = this.processFindArgs(options);
  var sql = app.mysql.build(args.parts);
  var values = args.values;

  return app.mysql.query({
    sql: sql,
    values: values,
    nestTables:true
  }, cb);
};

/**
 * Access check for models.
 *
 * `options` can contain:
 *   `options.method`, `options.user`, `options.model`
 *
 * `options.method` will be one of:
 *   list, create, read, update, delete
 */
Model.access = function (options, cb) {
  // Models should override this with their own access logic.
  cb(null, false);
};

/**
 * Convert a column key:value hash into an array of values.
 */
Model._objValues = function (obj) {
  var values = [];
  Object.keys(obj).forEach(function (key) {
    if (Array.isArray(obj[key])) {
      values = values.concat(obj[key]);
    }
    else {
      values.push(obj[key]);
    }
  });
  return values;
};

/**
 * Convert a column key:value hash into WHERE parts.
 */
Model._objConditions = function (obj) {
  var parts = [];
  var self = this;
  Object.keys(obj).forEach(function (key) {
    if (Array.isArray(obj[key])) {
      var placeholders = obj[key].map(function(val){ return "?"; }).join(', ');
      parts.push(self._table + ".`" + key + "` IN(" + placeholders + ")");
    }
    else {
      parts.push(self._table + ".`" + key + "` = ?");
    }
  });
  return parts;
};

// Return a list of the model's columns.
Model.columns = function () {
  var columns = [];
  for (var k in this._schema) columns.push(k);
  return columns;
};

// Return a list of the model's real columns (non-virtual).
Model._realColumns = function () {
  return this.columns().filter(function (k) {
    return !this._schema[k].virtual;
  }, this);
};

// Returns the SQL for querying by a model's keys.
Model._keyConditions = function () {
  var parts = [];

  if (this._key) {
    var self = this;
    this._key.forEach(function (col) {
      parts.push(self._table + "." + "`" + col + "` = ?");
    });
    return parts.join(" AND ");
  }
  else {
    return false;
  }
};

Model._relatedColumns = function () {
  return this.columns().filter(function (k) {
    return this._schema[k].related;
  }, this);
};

Model._aliasColumns = function () {
  return this.columns().filter(function (k) {
    return this._schema[k].alias_for;
  }, this);
};

/**
 * Model prototype.
 */
Model.prototype = {

  /**
   * Constructor.
   */
  constructor: function (values, isNew) {
    var self = this;

    if (isNew) {
      self._isNew = true;
    }
    if (isNew !== false && self._schema.id && !values.id) {
      self._isNew = true;
    }

    self._values = {};

    // Initialize column values.
    if (values) {
      self.columns.forEach(function (col) {
        if (typeof values[col] !== 'undefined') {
          if (self._schema[col].related) {
            self._setRelated(col, values[col]);
          }
          else if (self._schema[col].alias_for) {
            var realColumn = self._schema[col].alias_for;
            self._values[realColumn] = values[col];
          }
          else {
            self._values[col] = values[col];
          }
        }
      });
    }

    // Apply defaults.
    self._applyDefaults();

    self._changed = {};

    // Getters/Setters for columns.
    self.columns.forEach(function (col) {
      var def = self._schema[col];
      Object.defineProperty(self, col, {
        enumerable: true,
        get: def.get ? def.get.bind(self) : function () {
          return this._values[col];
        },
        set: (def.writable === false) ? undefined : (def.set ? def.set.bind(self) : function (value) {
          if (value == this._values[col]) return false;
          if (def.related) {
            this._setRelated(col, value);
          }
          else {
            this._values[col] = value;
          }
          this._isModified = true;
          this._changed[col] = true;
        })
      });
    });
  },

  /**
   * Update a model's attributes based on a hash of key:value pairs.
   */
  update: function (values, cols) {
    var self = this;
    values = values || {};
    self.columns.forEach(function (col) {
      if (typeof values[col] !== 'undefined' && (!cols || cols.indexOf(col) >= 0)) {
        self[col] = values[col];

        //Force modified flag of related columns for update.
        if (self._schema[col].related) {
          self[col]._isModified = true;
        }
      }
    });
  },

  // Return the type of the model.
  get _type () {
    return this.__class__._type;
  },

  // Return the name of the model's table.
  get _table () {
    return this.__class__._table;
  },

  // Return the schema of the model.
  get _schema () {
    return this.__class__._schema;
  },

  // Return the columns of the model.
  get columns () {
    return this.__class__.columns();
  },

  // Return the real columns of the model.
  get _realColumns () {
    return this.__class__._realColumns();
  },

  // Return the key columns of the model.
  get _key () {
    return this.__class__._key;
  },

  // Return the key conditions of the model.
  get _keyConditions () {
    return this.__class__._keyConditions();
  },

  get _relatedColumns () {
    return this.__class__._relatedColumns();
  },

  get _aliasColumns () {
    return this.__class__.aliasColumns();
  },

  /**
   * Return the model's column values.
   */
  toJSON: function () {
    var obj = {},
        self = this;

    function simplify (val) {
      if (val instanceof Model) {
        return val.toJSON();
      }
      else if (Array.isArray(val)) {
        return val.map(simplify);
      }
      else {
        return val;
      }
    }

    self.columns.forEach(function (col) {
      var val = simplify(self[col]);
      if (typeof val !== 'undefined') {
        obj[col] = val;
      }
    });

    return clone(obj);
  },

  /**
   * Return the model's real column values.
   */
  _realValues: function () {
    var obj = {},
        self = this;

    self._realColumns.forEach(function (col) {
      if (typeof self._values[col] !== 'undefined') {
        if (self._schema[col] && self._schema[col].serialized) {
          // Serialize value right before SQL query.
          obj[col] = JSON.stringify(self._values[col]);
        }
        else {
          obj[col] = self._values[col];
        }
      }
    });

    return clone(obj);
  },

  /**
   * Return the model's key values, as an array (for queries).
   */
  _keyValues: function () {
    var values = [],
        self = this;

    self._key.forEach(function (col) {
      if (typeof self[col] !== 'undefined') {
        values.push(self[col]);
      }
    });

    return values.slice(0);
  },

  /**
   * Apply defaults from the schema.
   */
  _applyDefaults: function () {
    var self = this;
    self.columns.forEach(function (col) {
      if (typeof self._schema[col].default !== 'undefined' && typeof self._values[col] === 'undefined') {
        if (typeof self._schema[col].default === 'function') {
          self._values[col] = self._schema[col].default.call(self);
        }
        else {
          self._values[col] = clone(self._schema[col].default);
        }
      }
    });
  },

  _setRelated: function (col, value) {
    var self = this;
    var def = self._schema[col].related;
    var relatedModel = value;

    //if value is not already a model, create it
    if (!(value instanceof def.model)) {
      relatedModel = new def.model(value);
    }

    //Set the referenced column values
    Object.keys(def.columns).forEach(function (key) {
      var relatedColumn = def.columns[key];
      if (self._schema[relatedColumn] && typeof relatedModel[key] != 'undefined') {
        self._values[relatedColumn] = relatedModel[key];
      }
    });

    self._values[col] = relatedModel;
  },

  /**
   * Prepare the model for saving.
   */
  prepare: function (related, cb) {
    var self = this;
    if (typeof related === 'function') {
      cb = related;
      related = null;
    }

    app.utils.async.series([

      // Run column prepare handlers.
      function (next) {
        self.columns.forEach(function (col) {
          if (typeof self._schema[col].prepare === 'function') {
            var ret = self._schema[col].prepare.call(self, self[col]);
            if (typeof ret !== 'undefined') {
              self._values[col] = ret;
            }
          }
        });
        next();
      },

      // Run related models prepare functions
      function (next) {
        if (related) {
          var tasks = self._relatedColumns.map(function (col) {
            return self[col].prepare.bind(self[col], related);
          });
          app.utils.async.parallel(tasks, next);
        }
        else {
          next();
        }
      },

      // Allow other code to hook into model prepare.
      function (next) {
        app.series('model:prepare', self, next);
      }
    ], cb);
  },

  /**
   * Validate a model.
   */
  validate: function (related, cb) {
    var self = this;
    if (typeof related === 'function') {
      cb = related;
      related = null;
    }

    // Run the validation checks in series, so the process can stop as soon as
    // there is an error.
    app.utils.async.series([

      // If the model has a `_table`, ensure is has values for all key columns.
      function (next) {
        if (self._table && self._key) {
          if (!self._key.length) {
            return next(new Error('Model `' + self._type + '` with a `_table` must have at least one key column'));
          }
          if (self._keyValues().length < self._key.length) {
            return next(new Error('Model `' + self._type + '` missing key column values'));
          }
        }
        next();
      },

      // Check required columns.
      function (next) {
        var hadError = self.columns.some(function (col) {
          if (self._schema[col].required && typeof self._values[col] === 'undefined') {
            next(new Error('Missing required property `' + col + '` for ' + self._type + ' model.'));
            return true;
          }
        });
        if (!hadError) next();
      },

      // Run column validators.
      function (next) {
        var tasks = self.columns.map(function (col) {
          return self._validateColumn.bind(self, col);
        });
        app.utils.async.series(tasks, next);
      },

      // Run related models validate functions
      function (next) {
        if (related) {
          var tasks = self._relatedColumns.map(function (col) {
            return self[col].validate.bind(self[col], related);
          });
          app.utils.async.series(tasks, next);
        }
        else {
          next();
        }
      },


      // Allow external hooks into model validation.
      function (next) {
        app.series('model:validate', self, next);
      }

    ], cb);
  },

  /**
   * Validate a column.
   */
  _validateColumn: function (col, cb) {
    var self = this,
        value = self._values[col],
        tasks = [],
        msg,
        err;

    if (!self._schema[col].validators) {
      return cb();
    }
    if (typeof value === 'undefined' || value === null) {
      return cb();
    }

    self._schema[col].validators.forEach(function (validator) {
      tasks.push(function (next) {
        msg = 'Validator `' + validator.name + '` failed for `' + col + '` with value `' + value + '` on a ' + self._type + ' model.';

        // Async validators.
        if (validator.length > 1) {
          validator(value, function (err) {
            return err ? next(Error(msg)) : next();
          });
        }
        // Sync validators.
        else {
          return validator(value) ? next() : next(Error(msg));
        }
      });
    });

    app.utils.async.series(tasks, cb);
  },

  /**
   * Save this model.
   */
  save: function (cb) {
    var self = this;

    // Default callback.
    cb = cb || function (err) {
      if (err) app.emit('error', err);
    };

    self.prepare(function (err) {
      if (err) return cb(err);

      self.validate(function (err) {
        if (err) return cb(err);

        if (self._table && self._realColumns) {
          self.cascade('save', function (err) {
            if (err) return cb(err);

            if (self._isNew) {
              app.mysql.query("INSERT INTO `" + self._table + "` SET ?", self._realValues(), function (err, results) {
                self.afterSave(err, results, cb);
              });
            }
            else if (self._isModified){
              var values = [self._realValues()].concat(self._keyValues());
              app.mysql.query("UPDATE `" + self._table + "` SET ? WHERE " + self._keyConditions, values, function (err, results) {
                self.afterSave(err, results, cb);
              });
            }
            else {
              self.afterSave(null, null, cb);
            }
          });
        }
        else {
          self.afterSave(null, null, cb);
        }
      });
    });
  },

  /**
   * Delete this model.
   */
  delete: function (cb) {
    var self = this;

    // Default callback.
    cb = cb || function (err) {
      if (err) app.emit('error', err);
    };

    if (self._table) {
      if (self._key) {

        app.series('model:beforeDeleted', self, function(err){
          if (err) app.log.error(err);
          app.mysql.query("DELETE FROM `" + self._table + "` WHERE " + self._keyConditions, self._keyValues(), function (err) {
            if (err) return cb(err);
            app.emit('model:deleted', self);
            self.cascade('delete', cb);
          });
        });
      }
      else {
        cb(new Error('Model does not have any key columns'));
      }
    }
    else {
      app.emit('model:deleted', self);
      cb();
    }
  },

  /**
   * Perform any after-save operations.
   */
  afterSave: function (err, results, cb) {
    if (err) return cb(err);
    var self = this;
    app.series('model:saved', this, function(err){
      var clone = new self.__class__(self.toJSON(), self._isNew);
      clone._changed = self._changed;
      app.emit('model:afterSave', clone);

      // At this point the model has been saved and is not new.
      delete self._isNew;
      delete self._isModified;
      self._changed = {};

      cb(err);
    });
  },

  cascade: function (operation, cb) {
    var self = this;
    var tasks = [];
    this._relatedColumns.forEach(function (col) {
      if (self[col]){
        var cascade = self._schema[col].related.cascade;
        switch(operation){
          case 'save':
            var execute = false;
            if (self[col]._isNew) {
              execute = (cascade === true || (_.isArray(cascade) && _.contains(cascade, 'create')));
            }
            else if (self[col]._isModified) {
              execute = (cascade === true || (_.isArray(cascade) && _.contains(cascade, 'update')));
            }

            if (execute) {
              tasks.push(function (done) {
                self[col].save.call(self[col], done);
              });
            }
            break;
          case 'delete':
            if (cascade === true || (_.isArray(cascade) && _.contains(cascade, 'delete'))) {
              tasks.push(function (done) {
                self[col].delete.call(self[col], done);
              });
            }
            break;
        }
      }
    });
    app.utils.async.parallel(tasks, cb);
  },

  populate: function (entities, cb) {
    var self = this;
    var tasks = [];
    entities.forEach(function (entity) {
      if (self._schema[entity] && self._schema[entity].related) {
        // If column defines its own populate method call it
        if (self._schema[entity].populate) {
          tasks.push(self._schema[entity].populate.bind(self));
        }
        // Otherwise build a findOne query based on the related columns
        else {
          tasks.push(function (done) {
            var conditions = _.clone(self._schema[entity].related.columns);
            _.each(conditions, function (value, key, list) {
              if (!(value.match(/^(\'|\")[^\'\"]+(\'|\")$/))) {
                list[key] = self[value];
              }
            });
            self._schema[entity].related.model.findOne({where: conditions}, function (err, model) {
              if (model) {
                self[entity] = model;
              }
              done(err);
            });
          });
        }
      }
      else {
        var nested = entity.split('.');
        var outer = nested.shift();
        var rest = nested.join('.');
        tasks.push(function (done) {
          if (self[outer]) {
            self[outer].populate([rest], done);
          }
          else {
            throw Error('Unknown related column supplied to Model.populate: ' + outer);
          }
        });
      }
    });
    app.utils.async.series(tasks, cb);
  }
};