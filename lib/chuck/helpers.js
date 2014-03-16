(function() {
  define('chuck/helpers', [], function() {
    var module;
    module = {};
    module.count = function(string, substr) {
      var num, pos;
      num = pos = 0;
      if (!substr.length) {
        return 1 / 0;
      }
      while (pos = 1 + string.indexOf(substr, pos)) {
        num++;
      }
      return num;
    };
    module.last = function(array, back) {
      return array[array.length - (back || 0) - 1];
    };
    module.throwSyntaxError = function(message, location) {
      var error;
      error = new SyntaxError(message);
      error.location = location;
      error.toString = syntaxErrorToString;
      error.stack = error.toString();
      throw error;
    };
    return module;
  });

}).call(this);
