(function() {
  define("chuck/logging", [], function() {
    var logger, methods, module, name, _i, _len;
    logger = void 0;
    module = {};
    methods = ['error', 'warn', 'info', 'debug', 'trace'];
    for (_i = 0, _len = methods.length; _i < _len; _i++) {
      name = methods[_i];
      module[name] = function() {
        return void 0;
      };
    }
    module.setLogger = function(logger) {
      var _j, _len1, _results;
      _results = [];
      for (_j = 0, _len1 = methods.length; _j < _len1; _j++) {
        name = methods[_j];
        if (!_.isFunction(logger[name])) {
          throw new Error("Logger lacks method " + name);
        }
        _results.push(module[name] = _.bind(logger[name], logger));
      }
      return _results;
    };
    return module;
  });

}).call(this);
