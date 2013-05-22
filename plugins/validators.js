var app = require('cantina');

app.validators = {};

app.validators.isType = function (type) {
  return function isType (val) {
    return typeof val === type;
  };
};

app.validators.matches = function (regex) {
  return function matches (val) {
    if (typeof val !== 'string') return false;
    return regex.test(val);
  };
};

app.validators.maxLength = function maxLength (length) {
  return function (val) {
    return val.length <= length;
  };
};

app.validators.minLength = function minLength (length) {
  return function (val) {
    return val.length >= length;
  };
};

app.validators.isId = app.validators.matches(/^[0-9a-zA-Z]{16}$/);

app.validators.isIdOrEmpty = function isIdOrEmpty (val) {
  return app.validators.isId(val) || (val === '');
};

app.validators.isDate = function isDate (val) {
  return (/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/).test(val);
};

app.validators.isEmail = function isEmail (val) {
  return /^[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:[a-z]{2}|com|org|net|edu|gov|mil|biz|info|mobi|name|aero|asia|jobs|museum)$/i.test(val);
};

app.validators.isUrl = function isUrl (val) {
  return /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/.test(val);
};

app.validators.isFlag = function isFlag (val) {
  return val === 0 || val === 1;
};