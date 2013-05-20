var app = require('cantina')
  , _ = require ('underscore');

/**
 * Backbone.js' extend.
 */
app.utils.extend = function (protoProps, staticProps) {
  var parent = this;
  var child;

  // The constructor function for the new subclass is either defined by you
  // (the "constructor" property in your `extend` definition), or defaulted
  // by us to simply call the parent's constructor.
  if (protoProps && _.has(protoProps, 'constructor')) {
    child = protoProps.constructor;
  } else {
    child = function(){ parent.apply(this, arguments); };
  }

  // Add static properties to the constructor function, if supplied.
  _.extend(child, parent, staticProps);

  // Set the prototype chain to inherit from `parent`, without calling
  // `parent`'s constructor function.
  var Surrogate = function(){ this.constructor = child; };
  Surrogate.prototype = parent.prototype;
  child.prototype = new Surrogate();

  // Add prototype properties (instance properties) to the subclass,
  // if supplied.
  if (protoProps) _.extend(child.prototype, protoProps);

  // Allow instances of the object to access static properties of itself.
  child.prototype.__class__ = child;

  // Ensure that the base class also has access to static properties of itself.
  if (!parent.prototype.__class__) parent.prototype.__class__ = parent;

  // Set a convenience property in case the parent's prototype is needed
  // later.
  child.__super__ = parent.prototype;

  return child;
};

/**
 * Clear the require cache for ALL .js files in ./plugins, and cantina core
 * plugins.
 */
app.utils.clearRequireCache = function () {
  Object.keys(require.cache).forEach(function (key) {
    delete require.cache[key];
  });
};
