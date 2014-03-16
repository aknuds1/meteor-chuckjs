(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  define("chuck/types", ["chuck/audioContextService", "chuck/namespace"], function(audioContextService, namespace) {
    var ChuckFunctionBase, ChuckMethod, ChuckStaticMethod, ChuckType, FunctionArg, FunctionOverload, OscData, TwoPi, constructDac, constructObject, constructOsc, module, oscNamespace, tickSinOsc, types, ugenNamespace;
    module = {};
    TwoPi = Math.PI * 2;
    module.ChuckType = ChuckType = (function() {
      function ChuckType(name, parent, opts, constructorCb) {
        this._constructParent = __bind(this._constructParent, this);
        this.findValue = __bind(this.findValue, this);
        this.isOfType = __bind(this.isOfType, this);
        var k, memberType, v, _ref;
        opts = opts || {};
        this.name = name;
        this.parent = parent;
        this.size = opts.size;
        this._constructor = constructorCb;
        this._opts = opts;
        this._namespace = new namespace.Namespace();
        this._constructParent(parent, this._opts);
        if (constructorCb != null) {
          constructorCb.call(this, this._opts);
        }
        opts.namespace = opts.namespace || {};
        _ref = opts.namespace;
        for (k in _ref) {
          if (!__hasProp.call(_ref, k)) continue;
          v = _ref[k];
          memberType = v instanceof ChuckFunctionBase ? types.Function : void 0;
          this._namespace.addVariable(k, memberType, v);
        }
      }

      ChuckType.prototype.isOfType = function(otherType) {
        var parent;
        if (this.name === otherType.name) {
          return true;
        }
        parent = this.parent;
        while (parent != null) {
          if (parent.isOfType(otherType)) {
            return true;
          }
          parent = parent.parent;
        }
        return false;
      };

      ChuckType.prototype.findValue = function(name) {
        var val;
        val = this._namespace.findValue(name);
        if (val != null) {
          return val;
        }
        if (this.parent != null) {
          return this.parent.findValue(name);
        }
      };

      ChuckType.prototype._constructParent = function(parent, opts) {
        if (parent == null) {
          return;
        }
        opts = _({}).extend(parent._opts).extend(opts).value();
        this._constructParent(parent.parent, opts);
        if (parent._constructor != null) {
          return parent._constructor.call(this, opts);
        }
      };

      return ChuckType;

    })();
    types = module.types = {};
    types.int = new ChuckType("int", void 0, {
      size: 8,
      preConstructor: void 0
    });
    types.float = new ChuckType("float", void 0, {
      size: 8,
      preConstructor: void 0
    });
    types.Time = new ChuckType("time", void 0, {
      size: 8,
      preConstructor: void 0
    });
    types.Dur = new ChuckType("Dur", void 0, {
      size: 8,
      preConstructor: void 0
    });
    types.String = new ChuckType("String", void 0, {
      size: 8,
      preConstructor: void 0
    });
    module.FunctionArg = FunctionArg = (function() {
      function FunctionArg(name, type) {
        this.name = name;
        this.type = type;
      }

      return FunctionArg;

    })();
    module.FunctionOverload = FunctionOverload = (function() {
      function FunctionOverload(args, func) {
        this.apply = __bind(this.apply, this);
        this["arguments"] = args;
        this.func = func;
        this.stackDepth = args.length;
      }

      FunctionOverload.prototype.apply = function(obj) {
        return this.func.apply(arguments[0], arguments[1]);
      };

      return FunctionOverload;

    })();
    ChuckFunctionBase = (function() {
      function ChuckFunctionBase(name, overloads, isMember, typeName, retType) {
        var i, overload, _i, _len;
        this.name = name;
        this.isMember = isMember;
        this._overloads = overloads;
        this.retType = retType;
        i = 0;
        for (_i = 0, _len = overloads.length; _i < _len; _i++) {
          overload = overloads[_i];
          overload.name = "" + name + "@" + (i++);
          overload.isMember = this.isMember;
          overload.retType = retType;
          if (this.isMember) {
            ++overload.stackDepth;
          }
          if (typeName != null) {
            overload.name = "" + overload.name + "@" + typeName;
          }
        }
      }

      ChuckFunctionBase.prototype.findOverload = function(args) {
        var mthd, _i, _len, _ref;
        _ref = this._overloads;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          mthd = _ref[_i];
          if (mthd["arguments"].length !== args.length) {
            continue;
          }
          if (!_.every(mthd["arguments"], function(a, index) {
            return a.type === args[index].type || (a.type === types.float && args[index].type === types.int);
          })) {
            continue;
          }
          return mthd;
        }
        return null;
      };

      return ChuckFunctionBase;

    })();
    module.ChuckMethod = ChuckMethod = (function(_super) {
      __extends(ChuckMethod, _super);

      function ChuckMethod(name, overloads, typeName, retType) {
        ChuckMethod.__super__.constructor.call(this, name, overloads, true, typeName, retType);
      }

      return ChuckMethod;

    })(ChuckFunctionBase);
    module.ChuckStaticMethod = ChuckStaticMethod = (function(_super) {
      __extends(ChuckStaticMethod, _super);

      function ChuckStaticMethod(name, overloads, typeName, retType) {
        ChuckStaticMethod.__super__.constructor.call(this, name, overloads, false, typeName, retType);
        this.isStatic = true;
      }

      return ChuckStaticMethod;

    })(ChuckFunctionBase);
    types.Function = new ChuckType("Function", null, null);
    constructObject = function() {};
    types.Object = new ChuckType("Object", void 0, {
      preConstructor: constructObject
    }, function(opts) {
      this.hasConstructor = opts.preConstructor != null;
      this.preConstructor = opts.preConstructor;
      return this.size = opts.size;
    });
    module.Class = new ChuckType("Class", types.Object);
    ugenNamespace = {
      gain: new ChuckMethod("gain", [
        new FunctionOverload([new FunctionArg("value", types.float)], function(value) {
          return this.setGain(value);
        })
      ], "UGen", types.float)
    };
    types.UGen = new ChuckType("UGen", types.Object, {
      size: 8,
      numIns: 1,
      numOuts: 1,
      preConstructor: void 0,
      namespace: ugenNamespace,
      ugenTick: void 0
    }, function(opts) {
      this.ugenNumIns = opts.numIns;
      this.ugenNumOuts = opts.numOuts;
      return this.ugenTick = opts.ugenTick;
    });
    OscData = (function() {
      function OscData() {
        this.num = 0.0;
        this.sync = 0;
        this.width = 0.5;
        this.phase = 0;
      }

      return OscData;

    })();
    oscNamespace = {
      freq: new ChuckMethod("freq", [
        new FunctionOverload([new FunctionArg("value", types.float)], function(value) {
          return this.setFrequency(value);
        })
      ], "Osc", types.float)
    };
    constructOsc = function() {
      this.data = new OscData();
      this.setFrequency = function(value) {
        this.data.num = (1 / audioContextService.getSampleRate()) * value;
        return value;
      };
      return this.setFrequency(220);
    };
    types.Osc = new ChuckType("Osc", types.UGen, {
      numIns: 1,
      numOuts: 1,
      preConstructor: constructOsc,
      namespace: oscNamespace
    });
    tickSinOsc = function() {
      var out;
      out = Math.sin(this.data.phase * TwoPi);
      this.data.phase += this.data.num;
      if (this.data.phase > 1) {
        this.data.phase -= 1;
      } else if (this.data.phase < 0) {
        this.data.phase += 1;
      }
      return out;
    };
    types.SinOsc = new ChuckType("SinOsc", types.Osc, {
      preConstructor: void 0,
      ugenTick: tickSinOsc
    });
    types.UGenStereo = new ChuckType("Ugen_Stereo", types.UGen, {
      numIns: 2,
      numOuts: 2,
      preConstructor: void 0
    });
    constructDac = function() {
      return this._node = audioContextService.outputNode;
    };
    types.Dac = new ChuckType("Dac", types.UGenStereo, {
      preConstructor: constructDac
    });
    types["void"] = new ChuckType("void");
    module.isObj = function(type) {
      return !module.isPrimitive(type);
    };
    module.isPrimitive = function(type) {
      return type === types.Dur || type === types.Time || type === types.int || type === types.float;
    };
    return module;
  });

}).call(this);
