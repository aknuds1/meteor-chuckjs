(function() {
  define("chuck/libs/math", ["chuck/types"], function(typesModule) {
    var ChuckStaticMethod, ChuckType, FunctionArg, FunctionOverload, Object, float, mathNamespace, module, types, _ref;
    ChuckType = typesModule.ChuckType, ChuckStaticMethod = typesModule.ChuckStaticMethod, FunctionArg = typesModule.FunctionArg, FunctionOverload = typesModule.FunctionOverload;
    _ref = typesModule.types, Object = _ref.Object, float = _ref.float;
    module = {};
    types = module.types = {};
    mathNamespace = {
      pow: new ChuckStaticMethod("pow", [
        new FunctionOverload([new FunctionArg("x", float), new FunctionArg("y", float)], function(x, y) {
          return Math.pow(x, y);
        })
      ], "Math", float)
    };
    types.Math = new ChuckType("Math", Object, {
      namespace: mathNamespace
    });
    return module;
  });

}).call(this);
