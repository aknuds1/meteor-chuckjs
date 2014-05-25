(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  define("chuck/types", ["chuck/audioContextService", "chuck/namespace", "chuck/logging"], function(audioContextService, namespace, logging) {
    var ChuckFunction, ChuckFunctionBase, ChuckMethod, ChuckStaticMethod, ChuckType, FuncArg, FunctionOverload, OscData, TwoPi, arrayNamespace, constructDac, constructObject, constructOsc, constructStep, module, oscNamespace, shredNamespace, stepNamespace, tickSinOsc, tickStep, types, ugenNamespace;
    module = {};
    TwoPi = Math.PI * 2;
    module.ChuckType = ChuckType = (function() {
      function ChuckType(name, parent, opts, constructorCb) {
        this._constructParent = __bind(this._constructParent, this);
        this.findValue = __bind(this.findValue, this);
        var k, memberType, v, _ref;
        opts = opts || {};
        this.name = name;
        this.parent = parent;
        this.size = opts.size;
        this._constructor = constructorCb;
        this._opts = opts;
        this._namespace = new namespace.Namespace();
        this.isRef = opts.isRef || false;
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
    types.dur = new ChuckType("dur", void 0, {
      size: 8,
      preConstructor: void 0
    });
    types.String = new ChuckType("String", void 0, {
      size: 8,
      preConstructor: void 0,
      isRef: true
    });
    module.FuncArg = FuncArg = (function() {
      function FuncArg(name, type) {
        this.name = name;
        this.type = type;
      }

      return FuncArg;

    })();
    module.FunctionOverload = FunctionOverload = (function() {
      function FunctionOverload(args, func, isBuiltIn, name) {
        this.isBuiltIn = isBuiltIn != null ? isBuiltIn : true;
        this.name = name != null ? name : null;
        args = args != null ? args : [];
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
        var overload, _i, _len;
        if (retType == null) {
          throw new Error('retType unspecified');
        }
        this.name = name;
        this.isMember = isMember;
        this._overloads = [];
        this.retType = retType;
        this._typeName = typeName;
        for (_i = 0, _len = overloads.length; _i < _len; _i++) {
          overload = overloads[_i];
          this.addOverload(overload);
        }
      }

      ChuckFunctionBase.prototype.addOverload = function(overload) {
        if (this._typeName) {
          overload.name = "" + overload.name + "@" + this._typename;
        }
        overload.isMember = this.isMember;
        overload.retType = this.retType;
        if (this.isMember) {
          ++overload.stackDepth;
        }
        return this._overloads.push(overload);
      };

      ChuckFunctionBase.prototype.findOverload = function(args) {
        var mthd, _i, _len, _ref;
        args = args != null ? args : [];
        _ref = this._overloads;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          mthd = _ref[_i];
          if (mthd["arguments"].length !== args.length) {
            continue;
          }
          if (!_.every(mthd["arguments"], function(a, index) {
            return a.type.isOfType(args[index].type) || (a.type === types.float && args[index].type === types.int);
          })) {
            continue;
          }
          return mthd;
        }
        return null;
      };

      ChuckFunctionBase.prototype.getNumberOfOverloads = function() {
        return this._overloads.length;
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
    module.ChuckFunction = ChuckFunction = (function(_super) {
      __extends(ChuckFunction, _super);

      function ChuckFunction(name, overloads, retType) {
        ChuckFunction.__super__.constructor.call(this, name, overloads, false, null, retType);
      }

      return ChuckFunction;

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
        new FunctionOverload([new FuncArg("value", types.float)], function(value) {
          return this.setGain(value);
        })
      ], "UGen", types.float),
      last: new ChuckMethod("last", [
        new FunctionOverload([], function() {
          return this.current;
        })
      ], "UGen", types.float)
    };
    types.UGen = new ChuckType("UGen", types.Object, {
      size: 8,
      numIns: 1,
      numOuts: 1,
      preConstructor: null,
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
        new FunctionOverload([], function() {
          return this.data.freq;
        }), new FunctionOverload([new FuncArg("value", types.float)], function(value) {
          return this.setFrequency(value);
        })
      ], "Osc", types.float),
      sync: new ChuckMethod("sync", [
        new FunctionOverload([], function() {
          return this.data.sync;
        }), new FunctionOverload([new FuncArg("value", types.int)], function(value) {
          if (value < 0 || value > 2) {
            value = 0;
          }
          return this.data.sync = value;
        })
      ], "Osc", types.int)
    };
    constructOsc = function() {
      this.data = new OscData();
      this.setFrequency = function(value) {
        this.data.freq = value;
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
    tickSinOsc = function(input) {
      var computeNum, d, freq, out;
      computeNum = function(d, freq) {
        d.num = freq / audioContextService.getSampleRate();
        if (d.num >= 1) {
          return d.num -= Math.floor(d.num);
        } else if (d.num <= -1) {
          return d.num += Math.floor(d.num);
        }
      };
      d = this.data;
      if (this.sources.length > 0) {
        if (d.sync === 0) {
          d.freq = input;
          computeNum(d, d.freq);
        } else if (d.sync === 2) {
          freq = d.freq + input;
          computeNum(d, freq);
        }
      }
      out = Math.sin(this.data.phase * TwoPi);
      d.phase += d.num;
      if (d.phase > 1) {
        d.phase -= 1;
      } else if (d.phase < 0) {
        d.phase += 1;
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
      preConstructor: void 0,
      namespace: {
        "pan": new ChuckMethod("pan", [
          new FunctionOverload([new FuncArg("value", types.float)], function(value) {
            var left, right;
            if (value < -1) {
              value = -1;
            } else if (value > 1) {
              value = 1;
            }
            left = this._channels[0];
            right = this._channels[1];
            left.pan = value < 0 ? 1 : 1 - value;
            right.pan = value > 0 ? 1 : 1 + value;
            return value;
          })
        ], "Osc", types.float)
      }
    });
    constructDac = function() {
      return this._node = audioContextService.outputNode;
    };
    types.Dac = new ChuckType("Dac", types.UGenStereo, {
      preConstructor: constructDac
    });
    types.Bunghole = new ChuckType("Bunghole", types.UGen);
    types["void"] = new ChuckType("void");
    types.Pan2 = new ChuckType("Pan2", types.UGenStereo);
    module.isObj = function(type) {
      return !module.isPrimitive(type);
    };
    module.isPrimitive = function(type) {
      return type === types.dur || type === types.Time || type === types.int || type === types.float;
    };
    types.Gain = new ChuckType("Gain", types.UGen);
    stepNamespace = {
      next: new ChuckMethod("next", [
        new FunctionOverload([new FuncArg("value", types.float)], function(value) {
          return this.data.next = value;
        })
      ], "Step", types.float)
    };
    constructStep = function() {
      return this.data.next = 1;
    };
    tickStep = function() {
      return this.data.next;
    };
    types.Step = new ChuckType("Step", types.Osc, {
      namespace: stepNamespace,
      preConstructor: constructStep,
      ugenTick: tickStep
    });
    shredNamespace = {
      args: new ChuckMethod("args", [
        new FunctionOverload([], function() {
          return this.args.length;
        })
      ], "Shred", types.int),
      arg: new ChuckMethod("arg", [
        new FunctionOverload([new FuncArg("i", types.int)], function(i) {
          return this.args[i];
        })
      ], "Shred", types.String)
    };
    types.shred = new ChuckType("Shred", types.Object, {
      namespace: shredNamespace
    });
    arrayNamespace = {
      cap: new ChuckMethod("cap", [
        new FunctionOverload([], function() {
          return this.length;
        })
      ], "@array", types.int),
      size: new ChuckMethod("size", [
        new FunctionOverload([], function() {
          return this.length;
        })
      ], "@array", types.int)
    };
    types["@array"] = new ChuckType("@array", types.Object, {
      size: 1,
      namespace: arrayNamespace
    });
    module.createArrayType = function(elemType, depth) {
      var type;
      type = new ChuckType(elemType.name, types["@array"]);
      type.depth = depth;
      type.arrayType = elemType;
      type.isArray = true;
      return type;
    };
    return module;
  });

}).call(this);
