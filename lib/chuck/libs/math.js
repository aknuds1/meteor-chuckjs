(function() {
  define("chuck/libs/math", ["chuck/types"], function(typesModule) {
    var ChuckStaticMethod, ChuckType, FuncArg, FunctionOverload, Object, float, int, mathNamespace, module, types, _ref;
    ChuckType = typesModule.ChuckType, ChuckStaticMethod = typesModule.ChuckStaticMethod, FuncArg = typesModule.FuncArg, FunctionOverload = typesModule.FunctionOverload;
    _ref = typesModule.types, Object = _ref.Object, float = _ref.float, int = _ref.int;
    module = {};
    types = module.types = {};
    mathNamespace = {
      pow: new ChuckStaticMethod("pow", [
        new FunctionOverload([new FuncArg("x", float), new FuncArg("y", float)], function(x, y) {
          return Math.pow(x, y);
        })
      ], "Math", float),
      random2: new ChuckStaticMethod("random2", [
        new FunctionOverload([new FuncArg("min", int), new FuncArg("max", int)], function(min, max) {
          return Math.floor(Math.random() * (max - min + 1)) + min;
        })
      ], "Math", int)
    };
    types.Math = new ChuckType("Math", Object, {
      namespace: mathNamespace
    });
    return module;
  });

}).call(this);
