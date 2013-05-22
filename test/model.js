describe('model', function () {
  var app;

  before(function (done) {
    app = createTestApp(function (err) {
      if (err) return done(err);
      require(app.root + '/plugins/model');

      app.model.schemas = {
        id: {
          id: {
            type: String,
            writable: false,
            required: true,
            validators: [app.validators.isId],
            default: function () {
              return idgen(16);
            }
          }
        }
      };

      app.init(done);
    });
  });

  after(function (done) {
    app.destroy(done);
  });

  // Schema defaults.
  describe('defaults', function () {
    var Baz;

    before(function () {
      var counter = 0;
      Baz = app.model.Model.extend({
        schema: {
          name: {
            default: 'brian'
          },
          count: {
            default: function () {
              return counter++;
            }
          }
        }
      });
    });

    it('should use defaults', function () {
      var model = new Baz();
      assert.equal(model.name, 'brian');
      assert.equal(model.count, 0);
    });

    it('should be able to override defaults', function () {
      var model = new Baz({name: 'carlos', count: 10});
      assert.equal(model.name, 'carlos');
      assert.equal(model.count, 10);
    });
  });

  // Required schema columns.
  describe('required', function () {
    var Bar;

    before(function () {
      Bar = app.model.Model.extend({
        schema: {
          mustHave: {
            required: true
          },
          optional: {

          }
        }
      });
    });

    it('should require schema columns that are `required`', function (done) {
      var model = new Bar();
      model.validate(function (err) {
        assert(err);
        var model = new Bar({mustHave: 'abc'});
        model.validate(function (err) {
          assert.ifError(err);
          done();
        });
      });
    });
  });

  // Schema validators.
  describe('validators', function () {
    var Foo, Bar;

    before(function () {
      Bar = app.model.Model.extend({
        schema: {
          id :{
            required: true,
            validators: [app.validators.isId]
          }
        }
      });
      Foo = app.model.Model.extend({
        schema: {
          isType: {
            validators: [app.validators.isType('string')]
          },
          matches: {
            validators: [app.validators.matches(/^bar$/)]
          },
          isId: {
            validators: [app.validators.isId]
          },
          isIdOrEmpty: {
            validators: [app.validators.isIdOrEmpty]
          },
          isDate: {
            validators: [app.validators.isDate]
          },
          isValidModel: {
            virtual: true,
            related: {
              model: Bar,
              columns: {
                id: '"4"'
              }
            }
          },
          maxLength: {
            validators: [app.validators.maxLength(10)]
          }
        }
      });
    });

    it('should be able to validate via `isType`', function (done) {
      var model = new Foo({isType: 'This is a string.'});
      model.validate(function (err) {
        assert.ifError(err);

        var model = new Foo({isType: 5});
        model.validate(function (err) {
          assert(err);
          done();
        });
      });
    });

    it('should be able to validate via `matches`', function (done) {
      var model = new Foo({matches: 'bar'});
      model.validate(function (err) {
        assert.ifError(err);

        var model = new Foo({matches: 'def'});
        model.validate(function (err) {
          assert(err);
          done();
        });
      });
    });

    it('should be able to validate via `isId`', function (done) {
      var model = new Foo({isId: idgen(16)});
      model.validate(function (err) {
        assert.ifError(err);

        var model = new Foo({isId: 'asdf'});
        model.validate(function (err) {
          assert(err);
          done();
        });
      });
    });

    it('should be able to validate via `isIdOrEmpty`', function (done) {
      var model = new Foo({isIdOrEmpty: idgen(16)});
      model.validate(function (err) {
        assert.ifError(err);

        var model = new Foo({isIdOrEmpty: ''});
        model.validate(function (err) {
          assert.ifError(err);

          var model = new Foo({isIdOrEmpty: 1234});
          model.validate(function (err) {
            assert(err);
            done();
          });
        });
      });
    });

    it('should be able to validate via `isDate`', function (done) {
      var model = new Foo({isDate: new Date()});
      model.validate(function (err) {
        assert(err);

        var model = new Foo({isDate: '2012-10-01 08:01:00'});
        model.validate(function (err) {
          assert.ifError(err);

          var model = new Foo({isDate: 1234});
          model.validate(function (err) {
            assert(err);
            done();
          });
        });
      });
    });

    it('should be able to perform deep validation', function(done){
      var model = new Foo({isValidModel: new Bar({})});
      model.validate(true, function(err){
        assert(err);

        var model = new Foo({isValidModel: new Bar({id: idgen(16)})});
        model.validate(true, function(err){
          assert.ifError(err);

          var model = new Foo({isValidModel: new Bar({id: 1})});
          model.validate(true, function(err){
            assert(err);
            done();
          });
        });
      });
    });

    it('should be able to validate via `maxLength`', function (done) {
      var model = new Foo({maxLength: '1234567890'});
      model.validate(function (err) {
        assert.ifError(err);

        var model = new Foo({maxLength: 'abcdefghijk'});
        model.validate(function (err) {
          assert(err);
          done();
        });
      });
    });
  }); // End validators.

  describe('virtual columns', function () {
    it('should support `virtual` columns', function (done) {
      var Person = app.model.Model.extend({
        schema: {
          first: {},
          last: {},
          name: {
            virtual: true,
            writable: false,
            get: function () {
              return this.first + ' ' + this.last;
            }
          }
        },
      });

      assert.equal(Person.columns().length, 3);
      assert.equal(Person._realColumns().length, 2);

      var actor = new Person({first: 'Bruce', last: 'Willis'});

      assert.equal(actor.name, 'Bruce Willis');
      assert.name = 'Arnold Schwarzenegger';
      assert.equal(actor.name, 'Bruce Willis');
      done();
    });
  });

  describe('related columns', function () {
    it('should support `related` columns', function (done) {
      var Person = app.model.Model.extend({
        schema: {
          id: {},
          name: {}
        }
      });
      var Book = app.model.Model.extend({
        schema: {
          title: {},
          author_id: {},
          author: {
            virtual: true,
            related: {
              model: Person,
              columns: {
                id: 'author_id'
              }
            }
          }
        }
      });

      assert.equal(Book.columns().length, 3);
      assert.equal(Book._realColumns().length, 2);
      assert.equal(Book._relatedColumns().length, 1);

      var author = new Person({name: 'Ayn Rand'});
      var book = new Book({title: 'Atlas Shrugged', author_id: author.id, author: author});
      assert.equal(author.id, book.author.id);
      assert.equal(author.name, book.author.name);

      book = new Book({title: 'In Cold Blood', author: {name: 'Truman Capote'}});
      assert(book.author instanceof Person);
      assert.equal(book.author_id, book.author.id);
      done();
    });
  });

  describe('alias columns', function () {
    var Person, Student;
    before(function(done){
      Person = app.model.Model.extend({
        table: 'person',
        key: ['name'],
        schema: {
          name: {},
          profession: {}
        }
      });
      Student = Person.extend({
        schema: _.extend(Person._schema, {
          major: {
            alias_for: 'profession'
          }
        })
      });
      app.mysql.query("CREATE TABLE IF NOT EXISTS person ( name VARCHAR(255), profession VARCHAR(255) ) ", done);
    });
    it('should support `alias_for` columns', function (done) {
      assert.equal(Student.columns().length, 3);
      assert.equal(Student._realColumns().length, 2);
      assert.equal(Student._aliasColumns().length, 1);

      var student = new Student({name: 'Harry', major: 'Biology'}, true);
      assert.equal(student.profession, 'Biology');
      assert.equal(student.major, 'Biology');
      student.major = 'Chemistry';
      assert.equal(student.profession, 'Chemistry');
      student.profession = 'Physics';
      assert.equal(student.major, 'Physics');

      student.save(function(err){
        assert.ifError(err);
        Student.findOne({where: {major: 'Physics'}}, function(err, found){
          assert.ifError(err);
          assert(found);
          done();
        });
      });
    });
  });

  describe('prepare', function () {
    var Foo, Bar;
    before(function(){
      Bar = app.model.Model.extend({
        schema: {
          upper: {
            prepare: function(val){
              return val.toUpperCase();
            }
          }
        }
      });
      Foo = app.model.Model.extend({
        schema: {
          lower: {
            prepare: function (val) {
              return val.toLowerCase();
            }
          },
          bar: {
            virtual: true,
            related: {
              model: Bar,
              columns: {
                upper: ''
              }
            }
          }
        }
      });
    });

    it('should support columns with `prepare` handlers', function (done) {
      var model = new Foo({lower: 'OMG'});
      model.prepare(function (err) {
        assert.ifError(err);
        assert.equal(model.lower, 'omg');
        done();
      });
    });

    it('should be able to perform deep preparation', function(done){
      var model = new Foo({lower: 'HEY', bar: new Bar({upper: 'hey'})});
      model.prepare(true, function(err){
        assert.ifError(err);
        assert.equal(model.lower, 'hey');
        assert.equal(model.bar.upper, 'HEY');
        done();
      });
    });
  });

  describe('update', function () {
    it('should support updating model values', function() {
      var Movie = app.model.Model.extend({
        schema: {
          title: {},
          genre: {}
        }
      });
      var movie = new Movie({title: 'Looper', genre: 'SciFi'});
      movie.update({title: 'The Mist', genre: 'Horror', director: 'Frank Darabont'});
      assert.equal(movie.title, 'The Mist');
      assert.equal(movie.genre, 'Horror');
      assert.equal(movie.director, undefined);
    });

    it('should support updating specific model values', function() {
      var Movie = app.model.Model.extend({
        schema: {
          title: {},
          genre: {}
        }
      });
      var movie = new Movie({title: 'Looper', genre: 'SciFi'});
      movie.update({title: 'The Mist', genre: 'Horror', director: 'Frank Darabont'}, ['genre', 'director']);
      assert.equal(movie.title, 'Looper');
      assert.equal(movie.genre, 'Horror');
      assert.equal(movie.director, undefined);
    });
  });

  describe('save', function () {
    var Fruit;

    before(function (done) {
      Fruit = app.model.Model.extend({
        table: 'fruit',
        key: ['name'],
        schema: {
          name: {},
          count: {
            default: 0
          }
        }
      });
      app.mysql.query("CREATE TABLE IF NOT EXISTS fruit ( name VARCHAR(255), count INT ) ", done);
    });

    it('should be able to insert into MySQL', function (done) {
      var apple = new Fruit({name: 'apple'}, true);
      apple.save(function (err) {
        assert.ifError(err);
        Fruit.findOne(function (err, apple){
          assert.ifError(err);
          assert.equal(apple.count, 0);
          done();
        });
      });
    });

    it('should be able to update MySQL', function (done) {
      Fruit.findOne(function (err, apple) {
        assert.ifError(err);
        apple.count++;
        apple.save(function (err) {
          assert.ifError(err);
          Fruit.findOne(function (err, apple) {
            assert.ifError(err);
            assert.equal(apple.count, 1);
            done();
          });
        });
      });
    });

    it('should save and update models with a multi-value key', function (done) {
      var Item = app.model.Model.extend({
        table: 'items',
        key: ['letter', 'number'],
        schema: {
          letter: {},
          number: {},
          score: {}
        }
      });

      app.utils.async.series([
        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS items ( letter VARCHAR(255), number INT, score INT ) ", next); },
        function (next) { new Item({letter: 'a', number: 1, score: 1}, true).save(next); },
        function (next) { new Item({letter: 'b', number: 1, score: 2}, true).save(next); },
        function (next) { new Item({letter: 'a', number: 2, score: 3}, true).save(next); },
        function (next) { new Item({letter: 'b', number: 2, score: 4}, true).save(next); },
        function (next) { new Item({letter: 'c', number: 4, score: 5}, true).save(next); }
      ], function (err) {
        assert.ifError(err);
        Item.findOne({letter: 'b', number: 2}, function (err, item) {
          assert.ifError(err);
          assert.equal(item.score, 4);
          item.score = 10;
          item.save(function (err) {
            assert.ifError(err);
            Item.findOne({letter: 'b', number: 2}, function (err, item) {
              assert.ifError(err);
              assert.equal(item.score, 10);
              done();
            });
          });
        });
      });
    });
  });

  describe('delete', function () {
    var Drink;

    before(function (done) {
      Drink = app.model.Model.extend({
        table: 'drink',
        key: ['name'],
        schema: {
          name: {},
          calories: {}
        }
      });
      app.mysql.query("CREATE TABLE IF NOT EXISTS drink ( name VARCHAR(255), calories INT ) ", done);
    });

    it('should be able to delete a model', function (done) {
      new Drink({name: 'Coke', calories: 200}, true).save(function (err) {
        assert.ifError(err);

        Drink.findOne(function (err, drink) {
          assert.ifError(err);
          assert.equal(drink.name, 'Coke');

          drink.delete(function (err) {
            assert.ifError(err);

            Drink.findOne(function (err, drink) {
              assert.ifError(err);
              assert.equal(drink, null);
              done();
            });
          });
        });
      });
    });
  });

  describe('cascade', function(){
    var Ingredient, Dish, Meal;

    before(function(done){

      Meal = app.model.Model.extend({
        type: 'meal',
        table: 'meals',
        key: ['id'],
        schema: [app.model.schemas.id,
          {
            name: {}
          }]
      });
      Dish = app.model.Model.extend({
        type: 'dish',
        table: 'dishes',
        key: ['id'],
        schema: [app.model.schemas.id,
          {
            name: {},
            meal_id: {},
            meal: {
              virtual: true,
              related: {
                model: Meal,
                columns: {
                  id: 'meal_id'
                },
                cascade: true
              }
            }
          }]
      });
      Ingredient = app.model.Model.extend({
        type: 'ingredient',
        table: 'ingredients',
        key: ['id'],
        schema: [app.model.schemas.id,
          {
            name: {},
            dish_id: {},
            dish: {
              virtual: true,
              related: {
                model: Dish,
                columns: {
                  id: 'dish_id'
                },
                cascade: true
              }
            }
          }]
      });
      app.utils.async.series([
        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS meals (id VARCHAR(16), name VARCHAR(255)) ", next); },
        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS dishes (id VARCHAR(16), name VARCHAR(255), meal_id VARCHAR(16)) ", next); },
        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS ingredients (id VARCHAR(16), name VARCHAR(255), dish_id VARCHAR(16)) ", next); }
      ], done);
    });

    it('should create related models when cascade is true', function(done){
      var cheese = new Ingredient({
        name: 'cheese',
        dish: {
          name: 'pizza'
        }
      }, true);
      cheese.save(function(err){
        assert.ifError(err);
        Dish.findByKey(cheese.dish_id, function(err, pizza){
          assert.ifError(err);
          assert(pizza);
          done();
        });
      });
    });
    it('should create related models when cascade contains create', function(done){
      Ingredient._schema.dish.related.cascade = ['create'];
      var pasta = new Ingredient({
        name: 'pasta',
        dish: {
          name: 'lasagna'
        }
      }, true);
      pasta.save(function(err){
        Dish.findByKey(pasta.dish_id, function(err, lasagna){
          assert.ifError(err);
          assert(lasagna);
          done();
        });
      });
    });

    it('should update related models when cascade contains `update`', function(done){
      Dish._schema.meal.related.cascade = ['update'];
      var dinner = new Meal({
        name: 'dinner'
      }, true);
      dinner.save(function(err){
        assert.ifError(err);
        var pizza = new Dish({
          name: 'pizza',
          meal: dinner
        }, true);
        pizza.save(function(err){
          assert.ifError(err);
          pizza.meal.name = 'lunch';
          pizza.save(function(err){
            assert.ifError(err);
            Meal.findByKey(pizza.meal_id, function(err, meal){
              assert.ifError(err);
              assert.equal(meal.name, 'lunch');
              done();
            });
          });
        });
      });
    });
    it('should delete related models cascade contains `delete`', function(done){
      Dish._schema.meal.related.cascade = ['delete'];
      var dinner = new Meal({
        name: 'dinner'
      }, true);
      dinner.save(function(err){
        assert.ifError(err);
        var pizza = new Dish({
          name: 'pizza',
          meal: dinner
        }, true);
        pizza.delete(function(err){
          assert.ifError(err);
          Meal.findByKey(dinner.id, function(err, meal){
            assert.ifError(err);
            assert(!meal);
            done();
          });
        });
      });
    });
    it('should not create new related models when cascade is unset', function (done){
      delete Ingredient._schema.dish.related.cascade;
      var egg = new Ingredient({
        name: 'egg',
        dish: {
          name: 'omelette'
        }
      }, true);
      egg.save(function(err){
        Dish.findByKey(egg.dish_id, function(err, omelette){
          assert.ifError(err);
          assert(!omelette);
          Dish._schema.meal.related.cascade = ['update'];
          var egg = new Ingredient({
            name: 'egg',
            dish: {
              name: 'omelette'
            }
          }, true);
          egg.save(function(err){
            Dish.findByKey(egg.dish_id, function(err, omelette){
              assert.ifError(err);
              assert(!omelette);
              done();
            });
          });
        });
      });
    });
    it('should not update related models when _isModified = false', function(done){
      var dinner = new Meal({
        name: 'dinner'
      }, true);
      dinner.save(function(err){
        assert.ifError(err);
        var pizza = new Dish({
          name: 'pizza',
          meal: dinner
        }, true);
        pizza.save(function(err){
          assert.ifError(err);
          pizza.meal.name = 'breakfast';
          pizza.meal._isModified = false;
          pizza.save(function(err){
            assert.ifError(err);
            Meal.findByKey(pizza.meal_id, function(err, meal){
              assert.ifError(err);
              assert.notEqual(meal.name, 'breakfast');
              done();
            });
          });
        });
      });
    });
    it('should not update related models when cascade does not contain `update`', function(done){
      Dish._schema.meal.related.cascade = ['create'];
      var dinner = new Meal({
        name: 'dinner'
      }, true);
      dinner.save(function(err){
        assert.ifError(err);
        var pizza = new Dish({
          name: 'pizza',
          meal: dinner
        }, true);
        pizza.save(function(err){
          assert.ifError(err);
          pizza.meal.name = 'lunch';
          pizza.save(function(err){
            assert.ifError(err);
            Meal.findByKey(pizza.meal_id, function(err, meal){
              assert.ifError(err);
              assert.notEqual(meal.name, 'lunch');
              done();
            });
          });
        });
      });
    });

    it('should not delete related models when cascade does not contain `delete`', function(done){
      Dish._schema.meal.related.cascade = ['update'];
      var dinner = new Meal({
        name: 'dinner'
      }, true);
      dinner.save(function(err){
        assert.ifError(err);
        var pizza = new Dish({
          name: 'pizza',
          meal: dinner
        }, true);
        pizza.delete(function(err){
          assert.ifError(err);
          Meal.findByKey(dinner.id, function(err, meal){
            assert.ifError(err);
            assert(meal);
            done();
          });
        });
      });
    });

  });

  describe('Model.extend()', function () {
    var Parent, Child;

    before(function () {

      Parent = app.model.Model.extend({
        schema: {
          hobby: {}
        }}, {
        add: function (a, b) { return a + b; }
      });

      Child = Parent.extend({
        schema: _.extend(Parent._schema, {
          color: {}
        })}, {
        subtract: function (a, b) { return a - b; }
      });

    });

    it('should be able to create sub-model classes', function () {
      var child = new Child({hobby: 'soccer', color: 'blue'});
      assert.equal(child.columns.length, 2);
      assert.equal(child.add(1, 2), 3);
      assert.equal(child.subtract(3, 2), 1);
    });
  });

  describe('Model.find() and Model.findOne()', function () {
    var Disc, Player, Throw;

    before(function (done) {
      Disc = app.model.Model.extend({
        table: 'discs',
        key: ['name'],
        schema: {
          name: {
            required: true
          },
          category: {
            required: true
          }
        }
      });
      Throw = app.model.Model.extend({
        table: 'throws',
        key: ['style'],
        schema: {
          style: {
            required: true
          },
          disc_name: {
            required: true
          },
          disc: {
            virtual: true,
            related: {
              model: Disc,
              columns: {
                name: 'disc_name'
              }
            }
          }
        }
      });
      Player = app.model.Model.extend({
        table: 'dgplayers',
        key: ['name'],
        schema: {
          name: {
            required: true
          },
          throw_style: {},
          throw: {
            virtual: true,
            related: {
              model: Throw,
              columns: {
                style: 'throw_style'
              }
            }
          }
        }
      });

      app.utils.async.series([
        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS discs (name VARCHAR(255), category VARCHAR(255))", next); },
        function (next) { new Disc({name: 'Aviar', category: 'putter'}, true).save(next); },
        function (next) { new Disc({name: 'Kite', category: 'approach'}, true).save(next); },
        function (next) { new Disc({name: 'Orc', category: 'driver'}, true).save(next); },
        function (next) { new Disc({name: 'Boss', category: 'driver'}, true).save(next); },
        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS throws (style VARCHAR(255), disc_name VARCHAR(255))", next); },
        function (next) { new Throw({style: 'Backhand', disc_name: 'Kite'}, true).save(next);},
        function (next) { new Throw({style: 'Backhand', disc_name: 'Aviar'}, true).save(next);},
        function (next) { new Throw({style: 'Forehand', disc_name: 'Orc'}, true).save(next); },
        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS dgplayers (name VARCHAR(255), throw_style VARCHAR(255))", next); },
        function (next) { new Player({name: 'Brian', throw_style: 'Backhand'}, true).save(next); },
        function (next) { new Player({name: 'Carlos', throw_style: 'Forehand'}, true).save(next); }
      ], done);
    });

    it('find() should find all models', function (done) {
      Disc.find(function (err, discs) {
        assert.ifError(err);
        assert.equal(discs.length, 4);
        done();
      });
    });

    it('find() should be able to find models via sql conditions', function (done) {
      var options = {
        where: "(`category` = ? OR `category` = ?)",
        values: ['putter', 'approach']
      };
      Disc.find(options, function (err, discs) {
        assert.ifError(err);
        assert.equal(discs.length, 2);
        done();
      });
    });

    it('find() should be able to find records via column values', function (done) {
      Disc.find({name: 'Orc'}, function (err, discs) {
        assert.ifError(err);
        assert.equal(discs.length, 1);
        done();
      });
    });

    it('find() should be able to find records via array of column values', function (done) {
      Disc.find({name: ['Orc', 'Aviar']}, function (err, discs) {
        assert.ifError(err);
        assert.equal(discs[0].name, 'Aviar');
        assert.equal(discs[1].name, 'Orc');
        assert.equal(discs.length, 2);
        done();
      });
    });

    it('find() should support mixing where string with key:value pairs', function (done) {
      Disc.find({category: 'driver', where: "name = 'Boss'"}, function (err, discs) {
        assert.ifError(err);
        assert.equal(discs[0].name, 'Boss');
        assert.equal(discs.length, 1);
        done();
      });
    });

    it('find() should support mixing where array with key:value pairs', function (done) {
      Disc.find({category: 'driver', where: ["name = 'Boss'"]}, function (err, discs) {
        assert.ifError(err);
        assert.equal(discs[0].name, 'Boss');
        assert.equal(discs.length, 1);
        done();
      });
    });

    it('find() should support mixing where hash with key:value pairs', function (done) {
      Disc.find({category: 'driver', where: {name: 'Boss'}}, function (err, discs) {
        assert.ifError(err);
        assert.equal(discs[0].name, 'Boss');
        assert.equal(discs.length, 1);
        done();
      });
    });

    it('find() should be able to sort results', function (done) {
      Disc.find({order: "`name` ASC"}, function (err, discs) {
        assert.ifError(err);
        assert.equal(discs[0].name, 'Aviar');
        assert.equal(discs[2].name, 'Kite');
        done();
      });
    });

    it('find() should be able to limit results', function (done) {
      Disc.find({limit: 2}, function (err, discs) {
        assert.ifError(err);
        assert.equal(discs.length, 2);
        done();
      });
    });

    it('find() should be able to limit and offset results', function (done) {
      Disc.find({order: "`name` ASC", limit: 1, offset: 1}, function (err, discs) {
        assert.ifError(err);
        assert.equal(discs.pop().name, 'Boss');
        done();
      });
    });

    it('find() should populate a related model', function(done){
      Player.find({ populate: ['throw']}, function (err, players){
        assert.ifError(err);
        assert.ok(players);
        players.forEach(function(player){
          if(player.throw){
            assert.ok(player.throw instanceof Throw);
            assert.equal(player.throw.style, player.throw_style);
          }
        });
        done();
      });
    });
    it('find() should populate a related model with a primitive column condition', function(done){
      Player._schema.throw.related.columns.disc_name = '"Kite"';
      Player.find({ populate: ['throw']}, function (err, players){
        assert.ifError(err);
        assert.ok(players);
        players.forEach(function(player){
          if(player.throw){
            assert.ok(player.throw instanceof Throw);
            assert.equal(player.throw.style, player.throw_style);
            assert.equal(player.throw.disc_name, 'Kite');
          }
        });
        done();
      });
    });
    it('find() should populate a nested related model', function(done){
      Player.find({ populate: ['throw', 'throw.disc']}, function (err, players){
        assert.ifError(err);
        assert.ok(players);
        players.forEach(function(player){
          if(player.throw){
            assert.ok(player.throw instanceof Throw);
            assert.equal(player.throw.style, player.throw_style);
            if(player.throw.disc){
              assert.ok(player.throw.disc instanceof Disc);
              assert.equal(player.throw.disc_name, player.throw.disc.name);
            }
          }
        });
        done();
      });
    });

    it('findOne() should find a model', function (done) {
      Disc.findOne(function (err, disc) {
        assert.ifError(err);
        assert(disc.name);
        done();
      });
    });

    it('findOne() should be able to find a model via sql conditions', function (done) {
      var options = {
        conditions: "category = ?",
        values: 'putter'
      };
      Disc.findOne(options, function (err, disc) {
        assert.ifError(err);
        assert.equal(disc.name, 'Aviar');
        done();
      });
    });

    it('findOne() should be able to find a model via column values', function (done) {
      Disc.findOne({name: 'Orc'}, function (err, disc) {
        assert.ifError(err);
        assert.equal(disc.category, 'driver');
        done();
      });
    });

    it('findOne() should be able to sort results', function (done) {
      Disc.findOne({order: "`name` DESC"}, function (err, disc) {
        assert.ifError(err);
        assert.equal(disc.name, 'Orc');
        done();
      });
    });
  });

  describe('findByKey()', function () {
    var NoKey, SingleKey, MultiKey;

    before(function(done) {
      NoKey = app.model.Model.extend({});

      SingleKey = app.model.Model.extend({
        table: 'single_key',
        key: ['the_key'],
        schema: {
          the_key: {},
          value: {}
        }
      });

      MultiKey = app.model.Model.extend({
        table: 'multi_key',
        key: ['key_one', 'key_two'],
        schema: {
          key_one: {},
          key_two: {},
          value: {},
          single: {
            virtual: true,
            related: {
              model: SingleKey,
              columns: {
                value: "'20'"
              }
            }
          }
        }
      });

      app.utils.async.series([
        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS single_key (the_key INT, value INT)", next); },
        function (next) { new SingleKey({the_key: 1, value: 10}, true).save(next); },
        function (next) { new SingleKey({the_key: 2, value: 20}, true).save(next); },
        function (next) { new SingleKey({the_key: 3, value: 30}, true).save(next); },

        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS multi_key (key_one INT, key_two INT, value INT)", next); },
        function (next) { new MultiKey({key_one: 1, key_two: 10, value: 100}, true).save(next); },
        function (next) { new MultiKey({key_one: 2, key_two: 20, value: 200}, true).save(next); },
        function (next) { new MultiKey({key_one: 3, key_two: 30, value: 300}, true).save(next); },
      ], done);
    });

    it('should cause an error if used on a model with no keys', function (done) {
      NoKey.findByKey('blah', function (err) {
        assert(err);
        done();
      });
    });

    it('should find a model with one key column via primitive value', function (done) {
      SingleKey.findByKey(2, function (err, model) {
        assert.ifError(err);
        assert.equal(model.value, 20);
        done();
      });
    });

    it('should find a model with one key column via an object', function (done) {
      SingleKey.findByKey({the_key: 3}, function (err, model) {
        assert.ifError(err);
        assert.equal(model.value, 30);
        done();
      });
    });

    it('should be able to find a model with a multi-column key', function (done) {
      MultiKey.findByKey({key_one: 2, key_two: 20}, function (err, model) {
        assert.ifError(err);
        assert.equal(model.value, 200);
        done();
      });
    });

    it('should cause an error if called with a primited on a multi-col key', function (done) {
      MultiKey.findByKey(1, function (err) {
        assert(err);
        done();
      });
    });

    it('should cause an error if missing key values', function (done) {
      MultiKey.findByKey({key_one: 3}, function (err) {
        assert(err);
        done();
      });
    });

    it('should invoke the callback with (null, null) if not model is found', function (done) {
      MultiKey.findByKey({key_one: 1, key_two: 20}, function (err, model) {
        assert.ifError(err);
        assert.strictEqual(model, null);
        done();
      });
    });

    it('should be able to accept find options', function(done){
      MultiKey.findByKey({key_one: 2, key_two: 20}, {populate: ['single']}, function(err, model){
        assert.ifError(err);
        assert(model.single instanceof SingleKey);
        done();
      });
    })
  });

  describe('streaming', function () {
    var Champion;

    before(function (done) {
      Champion = app.model.Model.extend({
        table: 'champions',
        key: ['name'],
        schema: {
          name: {},
          type: {}
        }
      });

      app.utils.async.series([
        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS champions (name VARCHAR(255), type VARCHAR(16))", next); },
        function (next) { new Champion({name: 'Karthas', type: 'AP'}, true).save(next); },
        function (next) { new Champion({name: 'Graves', type: 'AD'}, true).save(next); },
        function (next) { new Champion({name: 'Sona', type: 'Support'}, true).save(next); },
        function (next) { new Champion({name: 'Maoki', type: 'Jungle'}, true).save(next); }
      ], done);
    });

    it('should be able to stream results from find()', function (done) {
      var query = Champion.find();
      var count = 0;
      query.on('model', function (model) {
        count++;
      });
      query.on('end', function () {
        assert(count, 4);
        done();
      });
    });
  });

  describe('events', function () {
    var Show;

    before(function (done) {
      Show = app.model.Model.extend({
        table: 'shows',
        key: ['name'],
        schema: {
          name: {
            required: true
          },
          channel: {
            required: true
          }
        }
      });
      app.mysql.query("CREATE TABLE IF NOT EXISTS shows (name VARCHAR(255), channel VARCHAR(255))", done);
    });

    it('should emit an app-level event for saved models', function (done) {
      app.on('model:saved', function (model) {
        assert.equal(model.name, 'The Wire');
        assert.equal(model._isNew, true);
        app.removeAllListeners('model:saved');

        app.on('model:saved', function (model) {
          assert.equal(model.name, 'The Wire');
          assert.equal(typeof model._isNew, 'undefined');
          app.removeAllListeners('model:saved');
          done();
        });

        model.save();
      });
      new Show({name: 'The Wire', channel: 'HBO'}, true).save();
    });

    it('should emit an app-level event for deleted models', function (done) {
      app.on('model:deleted', function (model) {
        assert.equal(model.name, 'Firefly');
        app.removeAllListeners('model:deleted');
        done();
      });
      new Show({name: 'Firefly', channel: 'Fox'}, true).delete();
    });

    it('should invoke a `series` event for the prepare phase', function (done) {
      app.on('model:prepare', function (model) {
        assert.equal(model.channel, 'Showtime');
        app.removeAllListeners('model:prepare');
        done();
      });
      new Show({name: 'Homeland', channel: 'Showtime'}).save();
    });

    it('should invoke a `series` event for the validate phase', function (done) {
      app.on('model:validate', function (model, cb) {
        if (model.name == 'Lost' && model.channel !== 'ABC') {
          cb(Error('Wrong Channel'));
        }
        else {
          cb();
        }
      });
      new Show({name: 'Lost', channel: 'Fox'}).validate(function (err) {
        assert(err);
        done();
      });
    });

    it('should invoke a `series` event when a model is loading', function (done) {
      app.on('model:load', function (model) {
        model.loaded = true;
        app.removeAllListeners('model:load');
      });
      new Show({name: 'Homeland', channel: 'Showtime'}, true).save(function (err) {
        Show.findOne({name: 'Homeland'}, function (err, model) {
          assert.ifError(err);
          assert.equal(model.loaded, true);
          done();
        });
      });
    });
  });

  describe('populate', function(){
    var Movie, Role, Actor, TronRole;
    var movie_id = idgen(16);

    before(function(done){
      Movie = app.model.Model.extend({
        table: 'movies',
        key: ['id'],
        schema: [app.model.schemas.id,
          {
            title: {}
          }]
      });
      Role = app.model.Model.extend({
        table: 'roles',
        key: ['name'],
        schema: [{
          name: {
            required: true
          },
          movie_id: {},
          movie: {
            virtual: true,
            related: {
              model: Movie,
              columns: {
                id: "movie_id"
              }
            }
          }
        }]
      });
      TronRole = app.model.Model.extend({
        table: 'roles',
        key: ['name'],
        schema: [{
          name: {
            required: true
          },
          movie_id: {},
          movie: {
            virtual: true,
            related: {
              model: Movie,
              columns: {
                id: "movie_id"
              }
            },
            populate: function(done){
              var self = this;
              Movie.findOne({ title: "Tron"}, function(err, movie){
                if(movie)
                  self.movie = movie;
                done(err);
              });
            }
          }
        }]
      });
      Actor = app.model.Model.extend({
        table: 'actors',
        key: ['id'],
        schema: [app.model.schemas.id,
          {
            name: {},
            role_name: {},
            role: {
              virtual: true,
              related: {
                model: Role,
                columns: {
                  name: "role_name"
                }
              }
            }
          }]
      });
      app.utils.async.series([
        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS movies (id VARCHAR(16), title VARCHAR(255))", next); },
        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS roles (name VARCHAR(255), movie_id VARCHAR(16))", next);},
        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS actors (id VARCHAR(16), name VARCHAR(255), role_name VARCHAR(255))", next);},
        function (next) { new Movie({id: movie_id, title: 'The Big Lebowski'}, true).save(next); },
        function (next) { new Role({name: 'Dude', movie_id: movie_id}, true).save(next); },
        function (next) { new Actor({name: 'Jeff Bridges', role_name: 'Dude'}, true).save(next); }
      ], done);
    });

    it('should populate related models', function(done){
      Actor.findOne({}, function(err, actor){
        assert.ifError(err);
        assert.ok(actor);
        actor.populate(['role'], function(err){
          assert.ifError(err);
          assert.ok(actor.role instanceof Role);
          assert.equal(actor.role_name, actor.role.name);
          done();
        });
      });
    });

    it('should populate related nested models', function(done){
      Actor.findOne({}, function(err, actor){
        assert.ifError(err);
        assert.ok(actor);
        actor.populate(['role', 'role.movie'], function(err){
          assert.ifError(err);
          assert.ok(actor.role instanceof Role);
          assert.equal(actor.role_name, actor.role.name);
          assert.ok(actor.role.movie instanceof Movie);
          assert.equal(actor.role.movie_id, actor.role.movie.id);
          done();
        });
      });
    });

    it('should be able to override the default popluate method', function(done){
      TronRole.findOne({}, function(err, role){
        assert.ifError(err);
        assert.ok(role);
        role.populate(['movie'], function(err){
          assert.ifError(err);
          assert.ok(!role.movie);
          done();
        });
      });
    });
  });

  describe('state properties', function () {
    var Book, user_id, book;

    before(function (done) {
      user_id = idgen(16);
      Book = app.model.Model.extend({
        table: 'books',
        type: 'book',
        key: ['id'],
        schema: [
          app.model.schemas.id,
          {
            title: {},
            user_id: {},
          }]
      });
      app.utils.async.series([
        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS books (id VARCHAR(16), title VARCHAR(255), user_id VARCHAR(16))", next); }
      ], done);
    });

    after(function (done){
      app.mysql.query('DROP TABLE books', done);
    });

    it('`_isNew` should identify a new model', function (done) {
      var book = new Book({title: 'Hunger Games', user_id: idgen(16)}, true);
      assert(book._isNew);
      book.save( function (err) {
        assert.ifError(err);
        assert(!book._isNew);
        done();
      });
    });

    it('`_isModified` should identify a modified model', function (done) {
      var book = new Book({title: 'Hunger Games', user_id: idgen(16)}, true);
      book.save(function (err) {
        assert.ifError(err);
        assert(!book._isModified);
        book.user_id = idgen(16);
        assert(book._isModified);
        done();
      });
    });

    it('`_changed` should list modified properties', function (done) {
      var book = new Book({title: 'Hunger Games', user_id: idgen(16)}, true);
      book.title = 'Hunger Games 2';
      assert(book._changed.title);
      book.user_id = idgen(16);
      assert(book._changed.user_id);
      book.save(function (err) {
        assert.ifError(err);
        assert(!book._changed.title);
        assert(!book._changed.user_id);
        done();
      });
    });
  });

  describe('populate multiple same table', function () {
    var Book, Publisher, Person, user_id, book;

    before(function (done) {
      Person = app.model.Model.extend({
        table: 'people',
        type: 'person',
        key: ['id'],
        schema: [
          app.model.schemas.id,
          {
            name: {}
          }
        ]
      });
      Publisher = app.model.Model.extend({
        table: 'companies',
        type: 'publisher',
        key: ['id'],
        schema: [
          app.model.schemas.id,
          {
            name: {},
            founder_id: {},
            founder: {
              virtual: true,
              related: {
                model: Person,
                columns: {
                  id: 'founder_id'
                }
              }
            }
          }
        ]
      });
      Book = app.model.Model.extend({
        table: 'books',
        type: 'book',
        key: ['id'],
        schema: [
          app.model.schemas.id,
          {
            title: {},
            author_id: {},
            author: {
              virtual: true,
              related: {
                model: Person,
                columns: {
                  id: 'author_id'
                }
              }
            },
            publisher_id: {},
            publisher: {
              virtual: true,
              related: {
                model: Publisher,
                columns: {
                  id: 'publisher_id'
                }
              }
            }
          }]
      });
      app.utils.async.series([
        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS people (id VARCHAR(16), name VARCHAR(255))", next)},
        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS books (id VARCHAR(16), title VARCHAR(255), author_id VARCHAR(16), publisher_id VARCHAR(16))", next); },
        function (next) { app.mysql.query("CREATE TABLE IF NOT EXISTS companies (id VARCHAR(16), name VARCHAR(255), founder_id VARCHAR(16))", next)}
      ], done);
    });
    before(function (done) {
      var person1 = new Person({
        name: 'Donald'
      });
      person1.save(function (err){
        var pub = new Publisher({
          name: 'Random House',
          founder_id: person1.id
        }, true);
        pub.save(function (err){
          if (err) return done(err);
          var person2 = new Person({
            name: 'Ayn'
          });
          person2.save(function (err){
            new Book({
              title: 'Atlas Shrugged',
              author_id: person2.id,
              publisher_id: pub.id
            }, true).save(done);
          });
        });
      })

    });

    it ('does not populate both related users when populating one', function (done){

      Book.findOne({populate: ['publisher', 'publisher.founder']}, function (err, book){
        assert.ifError(err);
        assert(book);
        assert(book.publisher);
        assert(book.publisher.founder);
        assert(!book.author);
        done();
      });
    });

    it('can populate both related users correctly', function (done) {

      Book.findOne({populate: ['author', 'publisher', 'publisher.founder']}, function (err, book){
        assert.ifError(err);
        assert(book);
        assert(book.publisher);
        assert(book.publisher.founder);
        assert(book.author);
        assert.notEqual(book.author.id, book.publisher.founder.id);
        done();
      });
    });
  });
});