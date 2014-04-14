(function() {
  define("chuck/libs/std", ["chuck/types"], function(typesModule) {
    var ChuckStaticMethod, ChuckType, FuncArg, FunctionOverload, Object, float, int, module, stdNamespace, types, _ref;
    ChuckType = typesModule.ChuckType, ChuckStaticMethod = typesModule.ChuckStaticMethod, FuncArg = typesModule.FuncArg, FunctionOverload = typesModule.FunctionOverload;
    _ref = typesModule.types, Object = _ref.Object, float = _ref.float, int = _ref.int;
    module = {};
    types = module.types = {};
    stdNamespace = {
      mtof: new ChuckStaticMethod("mtof", [
        new FunctionOverload([new FuncArg("value", float)], function(value) {
          return Math.pow(2, (value - 69) / 12) * 440;
        })
      ], "Std", float)
    };
    types.Std = new ChuckType("Std", Object, {
      namespace: stdNamespace
    });
    return module;
  });

}).call(this);
