(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  define("chuck/nodes", ["chuck/types", "chuck/logging", "chuck/audioContextService"], function(typesModule, logging, audioContextService) {
    var AdditiveSubtractiveOperatorBase, Arg, ArrayExpression, AtChuckOperator, DivideOperator, ExpressionBase, ExpressionList, FunctionDefinition, GtLtOperatorBase, MinusChuckOperator, NodeBase, ParentNodeBase, PlusChuckOperator, PlusPlusOperatorBase, PrimaryArrayExpression, TimesDivideOperatorBase, TimesOperator, UnaryMinusOperator, module, types;
    module = {};
    types = typesModule.types;
    NodeBase = (function() {
      function NodeBase(nodeType) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        this.scanPass1 = __bind(this.scanPass1, this);
        this.nodeType = nodeType;
      }

      NodeBase.prototype.scanPass1 = function() {};

      NodeBase.prototype.scanPass2 = function() {};

      NodeBase.prototype.scanPass3 = function() {};

      NodeBase.prototype.scanPass4 = function() {};

      NodeBase.prototype.scanPass5 = function() {};

      return NodeBase;

    })();
    ParentNodeBase = (function() {
      function ParentNodeBase(child, nodeType) {
        this._scanArray = __bind(this._scanArray, this);
        this._scanPass = __bind(this._scanPass, this);
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        this.scanPass1 = __bind(this.scanPass1, this);
        this._child = child;
        this.nodeType = nodeType;
      }

      ParentNodeBase.prototype.scanPass1 = function(context) {
        return this._scanPass(1, context);
      };

      ParentNodeBase.prototype.scanPass2 = function(context) {
        return this._scanPass(2, context);
      };

      ParentNodeBase.prototype.scanPass3 = function(context) {
        return this._scanPass(3, context);
      };

      ParentNodeBase.prototype.scanPass4 = function(context) {
        return this._scanPass(4, context);
      };

      ParentNodeBase.prototype.scanPass5 = function(context) {
        return this._scanPass(5, context);
      };

      ParentNodeBase.prototype._scanPass = function(pass, context) {
        if (!this._child) {
          return;
        }
        if (_.isArray(this._child)) {
          return this._scanArray(this._child, pass, context);
        } else {
          return this._child["scanPass" + pass](context);
        }
      };

      ParentNodeBase.prototype._scanArray = function(array, pass, context) {
        var c, _i, _len;
        for (_i = 0, _len = array.length; _i < _len; _i++) {
          c = array[_i];
          if (_.isArray(c)) {
            this._scanArray(c, pass, context);
          } else {
            c["scanPass" + pass](context);
          }
        }
      };

      return ParentNodeBase;

    })();
    module.Program = (function(_super) {
      __extends(_Class, _super);

      function _Class(child) {
        _Class.__super__.constructor.call(this, child, "Program");
      }

      return _Class;

    })(ParentNodeBase);
    module.ExpressionStatement = (function(_super) {
      __extends(_Class, _super);

      function _Class(exp) {
        _Class.__super__.constructor.call(this, exp, "ExpressionStatement");
      }

      _Class.prototype.scanPass5 = function(context, opts) {
        opts = opts || {};
        this._child.scanPass5(context);
        this.ri = this._child.ri;
      };

      return _Class;

    })(ParentNodeBase);
    module.BinaryExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(exp1, operator, exp2) {
        _Class.__super__.constructor.call(this, "BinaryExpression");
        this.exp1 = exp1;
        this.operator = operator;
        this.exp2 = exp2;
      }

      _Class.prototype.scanPass2 = function(context) {
        this.exp1.scanPass2(context);
        this.exp2.scanPass2(context);
      };

      _Class.prototype.scanPass3 = function(context) {
        this.exp1.scanPass3(context);
        this.exp2.scanPass3(context);
      };

      _Class.prototype.scanPass4 = function(context) {
        this.exp1.scanPass4(context);
        logging.debug("BinaryExpression " + this.operator.name + ": Type checked LHS, type " + this.exp1.type.name);
        this.exp2.scanPass4(context);
        logging.debug("BinaryExpression " + this.operator.name + ": Type checked RHS, type " + this.exp2.type.name);
        this.type = this.operator.check(this.exp1, this.exp2, context);
        logging.debug("BinaryExpression " + this.operator.name + ": Type checked operator, type " + this.type.name);
      };

      _Class.prototype.scanPass5 = function(context) {
        logging.debug("Binary expression " + this.operator.name + ": Emitting LHS");
        this.exp1.scanPass5(context);
        logging.debug("Binary expression " + this.operator.name + ": Emitting RHS");
        this.exp2.scanPass5(context);
        logging.debug("Binary expression " + this.operator.name + ": Emitting operator");
        this.operator.emit(context, this.exp1, this.exp2);
        this.ri = this.operator.ri;
      };

      return _Class;

    })(NodeBase);
    ExpressionBase = (function(_super) {
      __extends(ExpressionBase, _super);

      function ExpressionBase(nodeType, meta) {
        if (meta == null) {
          meta = "value";
        }
        ExpressionBase.__super__.constructor.call(this, nodeType);
        this._meta = meta;
      }

      return ExpressionBase;

    })(NodeBase);
    module.ExpressionList = ExpressionList = (function(_super) {
      __extends(ExpressionList, _super);

      function ExpressionList(expression) {
        ExpressionList.__super__.constructor.call(this, "ExpressionList");
        this.expressions = [expression];
      }

      ExpressionList.prototype.prepend = function(expression) {
        this.expressions.splice(0, 0, expression);
        return this;
      };

      ExpressionList.prototype._scanPass = function(pass) {
        var exp, _i, _len, _ref;
        _ref = this.expressions;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          exp = _ref[_i];
          exp["scanPass" + pass].apply(exp, Array.prototype.slice.call(arguments, 1));
        }
      };

      ExpressionList.prototype.scanPass1 = _.partial(ExpressionList.prototype._scanPass, 1);

      ExpressionList.prototype.scanPass2 = _.partial(ExpressionList.prototype._scanPass, 2);

      ExpressionList.prototype.scanPass3 = _.partial(ExpressionList.prototype._scanPass, 3);

      ExpressionList.prototype.scanPass4 = function(context) {
        var exp;
        this._scanPass(4, context);
        this.types = (function() {
          var _i, _len, _ref, _results;
          _ref = this.expressions;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            exp = _ref[_i];
            _results.push(exp.type);
          }
          return _results;
        }).call(this);
        return this.type = this.types[0];
      };

      ExpressionList.prototype.scanPass5 = function(context) {
        this._scanPass(5, context);
        return this.ri = this.expressions[0].ri;
      };

      ExpressionList.prototype.getCount = function() {
        return this.expressions.length;
      };

      return ExpressionList;

    })(ExpressionBase);
    module.DeclarationExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(typeDecl, varDecls) {
        _Class.__super__.constructor.call(this, "DeclarationExpression");
        this.typeDecl = typeDecl;
        this.varDecls = varDecls;
      }

      _Class.prototype.scanPass2 = function(context) {
        this.type = context.findType(this.typeDecl.type);
        logging.debug("Variable declaration of type " + this.type.name);
      };

      _Class.prototype.scanPass3 = function(context) {
        var varDecl, _i, _len, _ref;
        _ref = this.varDecls;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          varDecl = _ref[_i];
          logging.debug("Adding variable '" + varDecl.name + "' of type " + this.type.name + " to current namespace");
          if (varDecl.array != null) {
            this.type = typesModule.createArrayType(this.type, varDecl.array.getCount());
            logging.debug("Variable is an array, giving it array type", this.type);
          }
          varDecl.value = context.addVariable(varDecl.name, this.type);
        }
      };

      _Class.prototype.scanPass4 = function(context) {
        var varDecl, _i, _len, _ref;
        _Class.__super__.scanPass4.call(this);
        _ref = this.varDecls;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          varDecl = _ref[_i];
          logging.debug("" + this.nodeType + " Checking variable " + varDecl.name);
          varDecl.value.isDeclChecked = true;
          context.addValue(varDecl.value);
        }
      };

      _Class.prototype.scanPass5 = function(context) {
        var varDecl, _i, _len, _ref;
        _Class.__super__.scanPass5.call(this);
        _ref = this.varDecls;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          varDecl = _ref[_i];
          if (varDecl.array != null) {
            if (varDecl.array.exp == null) {
              logging.debug("" + this.nodeType + ": Empty array, only allocating object", varDecl);
              this.ri = context.allocateLocal(this.type, varDecl.value).ri;
              return;
            }
            logging.debug("" + this.nodeType + ": Instantiating array", varDecl);
          } else {
            logging.debug("" + this.nodeType + ": Emitting Assignment for value:", varDecl.value);
          }
        }
        this.ri = context.emitAssignment(this.type, varDecl);
      };

      return _Class;

    })(ExpressionBase);
    module.TypeDeclaration = (function(_super) {
      __extends(_Class, _super);

      function _Class(type) {
        _Class.__super__.constructor.call(this, "TypeDeclaration");
        this.type = type;
      }

      return _Class;

    })(NodeBase);
    module.VariableDeclaration = (function(_super) {
      __extends(_Class, _super);

      function _Class(name, array) {
        _Class.__super__.constructor.call(this, "VariableDeclaration");
        this.name = name;
        this.array = array;
      }

      return _Class;

    })(NodeBase);
    module.PrimaryVariableExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(name) {
        _Class.__super__.constructor.call(this, "PrimaryVariableExpression", "variable");
        this.name = name;
        this._emitVar = false;
      }

      _Class.prototype.scanPass4 = function(context) {
        _Class.__super__.scanPass4.call(this);
        switch (this.name) {
          case "second":
            this.type = types.dur;
            break;
          case "ms":
            this.type = types.dur;
            break;
          case "samp":
            this.type = types.dur;
            break;
          case "hour":
            this.type = types.dur;
            break;
          case "true":
            this._meta = "value";
            return this.type = types.int;
          default:
            this.value = context.findValue(this.name);
            if (this.value == null) {
              this.value = context.findValue(this.name, true);
            }
            this.type = this.value.type;
            logging.debug("Primary variable of type " + this.type.name);
            return this.type;
        }
      };

      _Class.prototype.scanPass5 = function(context) {
        var r1, r2;
        _Class.__super__.scanPass5.call(this);
        switch (this.name) {
          case "second":
            this.ri = context.emitLoadConst(audioContextService.getSampleRate());
            break;
          case "ms":
            this.ri = context.emitLoadConst(audioContextService.getSampleRate() / 1000);
            break;
          case "samp":
            this.ri = context.emitLoadConst(1);
            break;
          case "hour":
            this.ri = context.emitLoadConst(audioContextService.getSampleRate() * 60 * 60);
            break;
          case "true":
            this.ri = context.emitLoadConst(1);
            break;
          default:
            if (!this.value.isContextGlobal || !context.isInFunction()) {
              this.ri = this.value.ri;
            } else {
              r1 = this.value.ri;
              this.ri = r2 = context.allocRegister();
              context.emitLoadGlobal(r1, r2);
            }
            logging.debug("" + this.nodeType + ": Variable at register " + this.ri + ": " + this.value.name);
        }
      };

      return _Class;

    })(ExpressionBase);
    module.PrimaryIntExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(value) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        _Class.__super__.constructor.call(this, "PrimaryIntExpression", "value");
        this.value = parseInt(value);
      }

      _Class.prototype.scanPass4 = function() {
        _Class.__super__.scanPass4.call(this);
        return this.type = types.int;
      };

      _Class.prototype.scanPass5 = function(context) {
        _Class.__super__.scanPass5.call(this);
        logging.debug("" + this.nodeType + ": Emitting LoadConst(" + this.value + ")");
        return this.ri = context.emitLoadConst(this.value);
      };

      return _Class;

    })(ExpressionBase);
    module.PrimaryFloatExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(value) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        _Class.__super__.constructor.call(this, "PrimaryFloatExpression", "value");
        this.value = parseFloat(value);
      }

      _Class.prototype.scanPass4 = function() {
        _Class.__super__.scanPass4.call(this);
        return this.type = types.float;
      };

      _Class.prototype.scanPass5 = function(context) {
        _Class.__super__.scanPass5.call(this);
        logging.debug("" + this.nodeType + ": Emitting LoadConst for " + this.value);
        return this.ri = context.emitLoadConst(this.value);
      };

      return _Class;

    })(ExpressionBase);
    module.PrimaryHackExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(expression) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        _Class.__super__.constructor.call(this, "PrimaryHackExpression", "value");
        this.expression = expression;
      }

      _Class.prototype.scanPass4 = function(context) {
        _Class.__super__.scanPass4.call(this, context);
        logging.debug("" + this.nodeType + " scanPass4: Checking child expression");
        this.expression.scanPass4(context);
      };

      _Class.prototype.scanPass5 = function(context) {
        var e, registers, t;
        _Class.__super__.scanPass5.call(this);
        logging.debug("" + this.nodeType + ": Emitting child expression");
        this.expression.scanPass5(context);
        logging.debug("" + this.nodeType + ": Emitting Gack, types:", (function() {
          var _i, _len, _ref, _results;
          _ref = this.expression.types;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            t = _ref[_i];
            _results.push(t.name);
          }
          return _results;
        }).call(this));
        registers = (function() {
          var _i, _len, _ref, _results;
          _ref = this.expression.expressions;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            e = _ref[_i];
            _results.push(e.ri);
          }
          return _results;
        }).call(this);
        context.emitGack(this.expression.types, registers);
      };

      return _Class;

    })(ExpressionBase);
    module.PrimaryStringExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(value) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        _Class.__super__.constructor.call(this, "PrimaryStringExpression", "value");
        this.value = value;
      }

      _Class.prototype.scanPass4 = function() {
        _Class.__super__.scanPass4.call(this);
        return this.type = types.String;
      };

      _Class.prototype.scanPass5 = function(context) {
        _Class.__super__.scanPass5.call(this);
        return this.ri = context.emitLoadConst(this.value);
      };

      return _Class;

    })(ExpressionBase);
    module.ArrayExpression = ArrayExpression = (function(_super) {
      __extends(ArrayExpression, _super);

      function ArrayExpression(base, indices) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        this.scanPass1 = __bind(this.scanPass1, this);
        ArrayExpression.__super__.constructor.call(this, "ArrayExpression", "variable");
        this.base = base;
        this.indices = indices;
      }

      ArrayExpression.prototype.scanPass1 = function() {
        ArrayExpression.__super__.scanPass1.call(this);
        this.base.scanPass1();
        return this.indices.scanPass1();
      };

      ArrayExpression.prototype.scanPass2 = function() {
        ArrayExpression.__super__.scanPass2.call(this);
        this.base.scanPass2();
        return this.indices.scanPass2();
      };

      ArrayExpression.prototype.scanPass3 = function() {
        ArrayExpression.__super__.scanPass3.call(this);
        this.base.scanPass3();
        return this.indices.scanPass3();
      };

      ArrayExpression.prototype.scanPass4 = function(context) {
        var baseType;
        ArrayExpression.__super__.scanPass4.call(this, context);
        logging.debug("" + this.nodeType + " scanPass4: Base");
        baseType = this.base.scanPass4(context);
        logging.debug("" + this.nodeType + " scanPass4: Indices");
        this.indices.scanPass4(context);
        this.type = baseType.arrayType;
        logging.debug("" + this.nodeType + " scanPass4: Type determined to be " + this.type.name);
        return this.type;
      };

      ArrayExpression.prototype.scanPass5 = function(context) {
        logging.debug("" + this.nodeType + " emitting");
        ArrayExpression.__super__.scanPass5.call(this, context);
        this.base.scanPass5(context);
        this.indices.scanPass5(context);
        logging.debug("" + this.nodeType + ": Emitting ArrayAccess (as variable: " + this._emitVar + ")");
        this.ri = context.allocRegister();
        context.emitArrayAccess(this.type, this.base.ri, this.indices.ri, this.ri, this._emitVar);
      };

      return ArrayExpression;

    })(ExpressionBase);
    module.FuncCallExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(base, args) {
        _Class.__super__.constructor.call(this, "FuncCallExpression");
        this.func = base;
        this.args = args;
      }

      _Class.prototype.scanPass1 = function() {
        logging.debug("" + this.nodeType + ": scanPass1");
        _Class.__super__.scanPass1.call(this);
        this.func.scanPass1();
        if (this.args != null) {
          return this.args.scanPass1();
        }
      };

      _Class.prototype.scanPass2 = function() {
        logging.debug("" + this.nodeType + ": scanPass2");
        _Class.__super__.scanPass2.call(this);
        this.func.scanPass2();
        if (this.args != null) {
          return this.args.scanPass2();
        }
      };

      _Class.prototype.scanPass3 = function() {
        logging.debug("" + this.nodeType + ": scanPass3");
        _Class.__super__.scanPass3.call(this);
        this.func.scanPass3();
        if (this.args != null) {
          return this.args.scanPass3();
        }
      };

      _Class.prototype.scanPass4 = function(context) {
        var funcGroup;
        _Class.__super__.scanPass4.call(this, context);
        logging.debug("" + this.nodeType + " scanPass4: Checking type of @func");
        this.func.scanPass4(context);
        if (this.args != null) {
          this.args.scanPass4(context);
        }
        funcGroup = this.func.value.value;
        logging.debug("" + this.nodeType + " scanPass4: Finding function overload");
        this._ckFunc = funcGroup.findOverload(this.args != null ? this.args.expressions : null);
        this.type = funcGroup.retType;
        logging.debug("" + this.nodeType + " scanPass4: Got function overload " + this._ckFunc.name + " with return type " + this.type.name);
        return this.type;
      };

      _Class.prototype.scanPass5 = function(context) {
        var argRegisters, r1;
        logging.debug("" + this.nodeType + " scanPass5");
        _Class.__super__.scanPass5.call(this, context);
        if (this._ckFunc.isMember) {
          logging.debug("" + this.nodeType + ": Scanning method instance");
          this.func.scanPass5(context);
        }
        if (this.args != null) {
          logging.debug("" + this.nodeType + ": Scanning arguments");
          this.args.scanPass5(context);
          argRegisters = this.args.expressions.map(function(exp) {
            return exp.ri;
          });
        } else {
          argRegisters = [];
        }
        r1 = context.emitLoadConst(this._ckFunc);
        this.ri = context.allocRegister();
        if (this._ckFunc.isBuiltIn) {
          if (this._ckFunc.isMember) {
            logging.debug("" + this.nodeType + ": Emitting instance method call");
            argRegisters.unshift(context.emitLoadLocal(this.func.ri));
            return context.emitFuncCallMember(r1, argRegisters, this.ri);
          } else {
            logging.debug("" + this.nodeType + ": Emitting static method call");
            return context.emitFuncCallStatic(r1, argRegisters, this.ri);
          }
        } else {
          logging.debug("" + this.nodeType + ": Emitting function call");
          return context.emitFuncCall(r1, argRegisters, this.ri);
        }
      };

      return _Class;

    })(ExpressionBase);
    module.DurExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(base, unit) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        _Class.__super__.constructor.call(this, "DurExpression");
        this.base = base;
        this.unit = unit;
      }

      _Class.prototype.scanPass2 = function(context) {
        _Class.__super__.scanPass2.call(this, context);
        logging.debug('DurExpression');
        this.base.scanPass2(context);
        return this.unit.scanPass2(context);
      };

      _Class.prototype.scanPass3 = function(context) {
        _Class.__super__.scanPass3.call(this, context);
        this.base.scanPass3(context);
        return this.unit.scanPass3(context);
      };

      _Class.prototype.scanPass4 = function(context) {
        _Class.__super__.scanPass4.call(this, context);
        this.type = types.dur;
        this.base.scanPass4(context);
        return this.unit.scanPass4(context);
      };

      _Class.prototype.scanPass5 = function(context) {
        _Class.__super__.scanPass5.call(this, context);
        this.base.scanPass5(context);
        this.unit.scanPass5(context);
        this.ri = context.allocRegister();
        return context.emitTimesNumber(this.base.ri, this.unit.ri, this.ri);
      };

      return _Class;

    })(ExpressionBase);
    module.UnaryExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(operator, exp) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.op = operator;
        this.exp = exp;
      }

      _Class.prototype.scanPass4 = function(context) {
        if (this.exp != null) {
          this.exp.scanPass4(context);
        }
        return this.type = this.op.check(this.exp);
      };

      _Class.prototype.scanPass5 = function(context) {
        logging.debug("UnaryExpression: Emitting expression");
        this.exp.scanPass5(context);
        logging.debug("UnaryExpression: Emitting operator");
        this.ri = context.allocRegister();
        this.op.emit(context, this.exp.ri, this.ri, this.exp.value.isContextGlobal);
      };

      return _Class;

    })(ExpressionBase);
    module.UnaryMinusOperator = UnaryMinusOperator = (function() {
      function UnaryMinusOperator() {
        this.name = "UnaryMinusOperator";
      }

      UnaryMinusOperator.prototype.check = function(exp) {
        if (exp.type === types.int || exp.type === types.float) {
          return exp.type;
        }
      };

      UnaryMinusOperator.prototype.emit = function(context, r1, r2) {
        logging.debug("" + this.name + " emit");
        context.emitNegateNumber(r1, r2);
      };

      return UnaryMinusOperator;

    })();
    module.ChuckOperator = (function() {
      function _Class() {
        this.emit = __bind(this.emit, this);
        this.check = __bind(this.check, this);
        this.name = "ChuckOperator";
      }

      _Class.prototype.check = function(lhs, rhs, context) {
        var funcGroup;
        if (lhs.type === rhs.type) {
          if (typesModule.isPrimitive(lhs.type) || lhs.type === types.String) {
            if (rhs._meta === "variable") {
              rhs._emitVar = true;
            }
            return rhs.type;
          }
        }
        if (lhs.type === types.dur && rhs.type === types.Time && rhs.name === "now") {
          return rhs.type;
        }
        if (lhs.type.isOfType(types.UGen) && rhs.type.isOfType(types.UGen)) {
          return rhs.type;
        }
        if (rhs.type.isOfType(types.Function)) {
          rhs.scanPass4(context);
          funcGroup = rhs.value.value;
          rhs._ckFunc = funcGroup.findOverload([lhs]);
          this.type = funcGroup.retType;
          logging.debug("" + this.name + " check: Got function overload " + rhs._ckFunc.name + " with return type " + this.type.name);
          return this.type;
        }
        if (lhs.type === types.int && rhs.type === types.float) {
          lhs.castTo = rhs.type;
          return types.float;
        }
      };

      _Class.prototype.emit = function(context, lhs, rhs) {
        var argRegisters, isArray, lType, r1, rType;
        logging.debug("" + this.name + " emit");
        lType = lhs.castTo != null ? lhs.castTo : lhs.type;
        rType = rhs.castTo != null ? rhs.castTo : rhs.type;
        if (lType.isOfType(types.UGen) && rType.isOfType(types.UGen)) {
          context.emitUGenLink(lhs.ri, rhs.ri);
          this.ri = rhs.ri;
        } else if (lType.isOfType(types.dur) && rType.isOfType(types.Time)) {
          if (rhs.name === "now") {
            context.emitTimeAdvance(lhs.ri);
          }
        } else if (rType.isOfType(types.Function)) {
          this.ri = context.allocRegister();
          if (rhs._ckFunc.isMember) {
            logging.debug("" + this.name + ": Emitting instance method " + rhs._ckFunc.name);
            r1 = context.emitDotMemberFunc(rhs._ckFunc, rhs.ri);
          } else {
            logging.debug("" + this.name + ": Emitting function " + rhs._ckFunc.name);
            r1 = context.emitLoadConst(rhs._ckFunc);
          }
          argRegisters = [context.emitLoadLocal(lhs.ri)];
          if (rhs._ckFunc.isMember) {
            argRegisters.unshift(context.emitLoadLocal(rhs.ri));
            logging.debug("" + this.name + " emitting instance method call");
            context.emitFuncCallMember(r1, argRegisters, this.ri);
          } else {
            logging.debug("" + this.name + " emitting static method call");
            context.emitFuncCallStatic(r1, argRegisters, this.ri);
          }
        } else if (lType.isOfType(rType)) {
          isArray = rhs.indices != null;
          if (!isArray) {
            logging.debug("" + this.name + " emitting OpAtChuck to assign one object to another");
          } else {
            logging.debug("" + this.name + " emitting OpAtChuck to assign an object to an array element");
          }
          context.emitOpAtChuck(lhs.ri, rhs.ri, isArray);
          this.ri = rhs.ri;
        }
      };

      return _Class;

    })();
    module.UnchuckOperator = (function() {
      function _Class() {
        this.emit = __bind(this.emit, this);
        this.check = __bind(this.check, this);
        this.name = "UnchuckOperator";
      }

      _Class.prototype.check = function(lhs, rhs, context) {
        if (lhs.type.isOfType(types.UGen) && rhs.type.isOfType(types.UGen)) {
          return rhs.type;
        }
      };

      _Class.prototype.emit = function(context, lhs, rhs) {
        if (lhs.type.isOfType(types.UGen) && rhs.type.isOfType(types.UGen)) {
          context.emitUGenUnlink(lhs.ri, rhs.ri);
        }
      };

      return _Class;

    })();
    module.AtChuckOperator = AtChuckOperator = (function() {
      function AtChuckOperator() {
        this.name = "AtChuckOperator";
      }

      AtChuckOperator.prototype.check = function(lhs, rhs) {
        rhs._emitVar = true;
        return rhs.type;
      };

      AtChuckOperator.prototype.emit = function(context, lhs, rhs) {
        context.emitOpAtChuck(lhs.ri, rhs.ri);
      };

      return AtChuckOperator;

    })();
    module.PlusChuckOperator = PlusChuckOperator = (function() {
      function PlusChuckOperator() {
        this.name = "PlusChuckOperator";
      }

      PlusChuckOperator.prototype.check = function(lhs, rhs) {
        if ((lhs.type === rhs.type) || (lhs.type === types.int && rhs.type === types.float)) {
          if (typesModule.isPrimitive(lhs.type) || lhs.type === types.String) {
            if (rhs._meta === "variable") {
              rhs._emitVar = true;
            }
            return rhs.type;
          }
        }
      };

      PlusChuckOperator.prototype.emit = function(context, lhs, rhs) {
        this.ri = rhs.ri;
        return context.emitPlusAssign(rhs.ri, lhs.ri, this.ri);
      };

      return PlusChuckOperator;

    })();
    module.MinusChuckOperator = MinusChuckOperator = (function() {
      function MinusChuckOperator() {
        this.name = "MinusChuckOperator";
      }

      MinusChuckOperator.prototype.check = function(lhs, rhs) {
        if (lhs.type === rhs.type) {
          if (typesModule.isPrimitive(lhs.type) || lhs.type === types.String) {
            if (rhs._meta === "variable") {
              rhs._emitVar = true;
            }
            return rhs.type;
          }
        }
      };

      MinusChuckOperator.prototype.emit = function(context, lhs, rhs) {
        this.ri = rhs.ri;
        return context.emitMinusAssign(rhs.ri, lhs.ri, this.ri);
      };

      return MinusChuckOperator;

    })();
    AdditiveSubtractiveOperatorBase = (function() {
      function AdditiveSubtractiveOperatorBase() {}

      AdditiveSubtractiveOperatorBase.prototype.check = function(lhs, rhs) {
        if (lhs.type === rhs.type) {
          return lhs.type;
        }
        if ((lhs.type === types.dur && rhs.type === types.Time) || (lhs.type === types.Time && rhs.type === types.dur)) {
          return types.Time;
        }
        if (lhs.type === types.int && rhs.type === types.int) {
          return types.int;
        }
        if ((lhs.type === types.float && rhs.type === types.float) || (lhs.type === types.int && rhs.type === types.float) || (lhs.type === types.float && rhs.type === types.int)) {
          return types.float;
        }
      };

      return AdditiveSubtractiveOperatorBase;

    })();
    module.PlusOperator = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        this.name = "PlusOperator";
      }

      _Class.prototype.emit = function(context, lhs, rhs) {
        this.ri = context.allocRegister();
        logging.debug("PlusOperator emitting AddNumber for registers " + lhs.ri + " and " + rhs.ri + " to register " + this.ri);
        return context.emitAddNumber(lhs.ri, rhs.ri, this.ri);
      };

      return _Class;

    })(AdditiveSubtractiveOperatorBase);
    PlusPlusOperatorBase = (function() {
      function _Class(name) {
        this.name = name;
      }

      _Class.prototype.check = function(exp) {
        var type;
        exp._emitVar = true;
        type = exp.type;
        if (type === types.int || type === types.float) {
          return type;
        } else {
          return null;
        }
      };

      return _Class;

    })();
    module.PrefixPlusPlusOperator = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        _Class.__super__.constructor.call(this, "PrefixPlusPlusOperator");
      }

      _Class.prototype.emit = function(context, r1, r2) {
        logging.debug("" + this.name + " emitting PreIncNumber");
        return context.emitPreIncNumber(r1, r2);
      };

      return _Class;

    })(PlusPlusOperatorBase);
    module.PostfixPlusPlusOperator = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        _Class.__super__.constructor.call(this, "PostfixPlusPlusOperator");
      }

      _Class.prototype.emit = function(context, r1, r2) {
        logging.debug("" + this.name + " emitting PostIncNumber");
        return context.emitPostIncNumber(r1, r2);
      };

      return _Class;

    })(PlusPlusOperatorBase);
    module.MinusOperator = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        this.name = "MinusOperator";
      }

      _Class.prototype.emit = function(context, lhs, rhs) {
        logging.debug("" + this.name + " emitting SubtractNumber");
        this.ri = context.allocRegister();
        context.emitSubtractNumber(lhs.ri, rhs.ri, this.ri);
      };

      return _Class;

    })(AdditiveSubtractiveOperatorBase);
    module.MinusMinusOperator = (function() {
      function _Class() {
        this.name = "MinusMinusOperator";
      }

      return _Class;

    })();
    TimesDivideOperatorBase = (function() {
      function TimesDivideOperatorBase() {}

      TimesDivideOperatorBase.prototype.check = function(lhs, rhs, context) {
        var lhsType, rhsType;
        lhsType = lhs.type;
        rhsType = rhs.type;
        if (lhs.type === types.int && rhs.type === types.float) {
          lhsType = lhs.castTo = types.float;
        } else if (lhs.type === types.float && rhs.type === types.int) {
          rhsType = rhs.castTo = types.float;
        }
        if (lhsType === types.float && rhsType === types.float) {
          return types.float;
        }
        if (lhsType === types.int && rhsType === types.int) {
          return types.int;
        }
        if (lhsType === types.float && rhsType === types.dur) {
          return types.dur;
        }
      };

      return TimesDivideOperatorBase;

    })();
    module.TimesOperator = TimesOperator = (function(_super) {
      __extends(TimesOperator, _super);

      function TimesOperator() {
        this.name = "TimesOperator";
      }

      TimesOperator.prototype.emit = function(context, lhs, rhs) {
        this.ri = context.allocRegister();
        context.emitTimesNumber(lhs.ri, rhs.ri, this.ri);
      };

      return TimesOperator;

    })(TimesDivideOperatorBase);
    module.DivideOperator = DivideOperator = (function(_super) {
      __extends(DivideOperator, _super);

      function DivideOperator() {
        this.name = "DivideOperator";
      }

      DivideOperator.prototype.check = function(lhs, rhs, context) {
        var type;
        logging.debug("" + this.name + " scanPass4");
        type = DivideOperator.__super__.check.call(this, lhs, rhs, context);
        if (type != null) {
          return type;
        }
        if ((lhs.type === types.dur && rhs.type === types.dur) || (lhs.type === types.Time && rhs.type === types.dur)) {
          logging.debug("" + this.name + " scanPass4: Deduced the type to be float");
          return types.float;
        }
      };

      DivideOperator.prototype.emit = function(context, lhs, rhs) {
        this.ri = context.allocRegister();
        context.emitDivideNumber(lhs.ri, rhs.ri, this.ri);
      };

      return DivideOperator;

    })(TimesDivideOperatorBase);
    GtLtOperatorBase = (function() {
      function GtLtOperatorBase() {
        this.check = __bind(this.check, this);
      }

      GtLtOperatorBase.prototype.check = function(lhs, rhs) {
        if (lhs.type === rhs.type) {
          return lhs.type;
        }
        if (lhs.type === types.Time && rhs.type === types.Time) {
          return types.int;
        }
      };

      return GtLtOperatorBase;

    })();
    module.LtOperator = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        this.emit = __bind(this.emit, this);
        this.name = "LtOperator";
      }

      _Class.prototype.emit = function(context, lhs, rhs) {
        logging.debug("" + this.name + ": Emitting");
        this.ri = context.allocRegister();
        return context.emitLtNumber(lhs.ri, rhs.ri, this.ri);
      };

      return _Class;

    })(GtLtOperatorBase);
    module.GtOperator = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        this.name = "GtOperator";
      }

      _Class.prototype.emit = function(context, lhs, rhs) {
        logging.debug("" + this.name + ": Emitting");
        this.ri = context.allocRegister();
        return context.emitGtNumber(lhs.ri, rhs.ri, this.ri);
      };

      return _Class;

    })(GtLtOperatorBase);
    module.WhileStatement = (function(_super) {
      __extends(_Class, _super);

      function _Class(cond, body) {
        _Class.__super__.constructor.call(this, "WhileStatement");
        this.condition = cond;
        this.body = body;
      }

      _Class.prototype.scanPass1 = function() {
        this.condition.scanPass1();
        this.body.scanPass1();
      };

      _Class.prototype.scanPass2 = function(context) {
        this.condition.scanPass2(context);
        this.body.scanPass2(context);
      };

      _Class.prototype.scanPass3 = function(context) {
        this.condition.scanPass3(context);
        this.body.scanPass3(context);
      };

      _Class.prototype.scanPass4 = function(context) {
        logging.debug("WhileStatement: Type checking condition");
        this.condition.scanPass4(context);
        logging.debug("WhileStatement: Body");
        this.body.scanPass4(context);
      };

      _Class.prototype.scanPass5 = function(context) {
        var branchEq, breakJmp, r2, startIndex;
        startIndex = context.getNextIndex();
        this.condition.scanPass5(context);
        r2 = context.emitLoadConst(false);
        logging.debug("WhileStatement: Emitting BranchEq");
        branchEq = context.emitBranchEq(this.condition.ri, r2);
        this.body.scanPass5(context);
        logging.debug("WhileStatement: Emitting GoTo (instruction number " + startIndex + ")");
        context.emitGoto(startIndex);
        context.evaluateBreaks();
        breakJmp = context.getNextIndex();
        logging.debug("WhileStatement: Configuring BranchEq instruction to jump to instruction number " + breakJmp);
        branchEq.jmp = breakJmp;
      };

      return _Class;

    })(NodeBase);
    module.ForStatement = (function(_super) {
      __extends(_Class, _super);

      function _Class(c1, c2, c3, body) {
        _Class.__super__.constructor.call(this, "ForStatement");
        this.c1 = c1;
        this.c2 = c2;
        this.c3 = c3;
        this.body = body;
      }

      _Class.prototype.scanPass2 = function(context) {
        this.c1.scanPass2(context);
        this.c2.scanPass2(context);
        if (this.c3 != null) {
          this.c3.scanPass2(context);
        }
        this.body.scanPass2(context);
      };

      _Class.prototype.scanPass3 = function(context) {
        logging.debug("" + this.nodeType);
        context.enterScope();
        this.c1.scanPass3(context);
        this.c2.scanPass3(context);
        if (this.c3 != null) {
          this.c3.scanPass3(context);
        }
        this.body.scanPass3(context);
        context.exitScope();
      };

      _Class.prototype.scanPass4 = function(context) {
        logging.debug("" + this.nodeType);
        context.enterScope();
        logging.debug("" + this.nodeType + ": Checking the initial");
        this.c1.scanPass4(context);
        logging.debug("" + this.nodeType + ": Checking the condition");
        this.c2.scanPass4(context);
        if (this.c3 != null) {
          logging.debug("" + this.nodeType + ": Checking the post");
          this.c3.scanPass4(context);
        }
        logging.debug("" + this.nodeType + ": Checking the body");
        this.body.scanPass4(context);
        context.exitScope();
      };

      _Class.prototype.scanPass5 = function(context) {
        var branchEq, breakJmp, startIndex;
        context.enterCodeScope();
        logging.debug("" + this.nodeType + ": Emitting the initial");
        this.c1.scanPass5(context);
        startIndex = context.getNextIndex();
        logging.debug("" + this.nodeType + ": Emitting the condition");
        this.c2.scanPass5(context);
        branchEq = context.emitBranchEq(this.c2.ri, context.emitLoadConst(false));
        context.enterCodeScope();
        logging.debug("" + this.nodeType + ": Emitting the body");
        this.body.scanPass5(context);
        context.exitCodeScope();
        if (this.c3 != null) {
          logging.debug("" + this.nodeType + ": Emitting the post");
          this.c3.scanPass5(context);
        }
        logging.debug("ForStatement: Emitting GoTo (instruction number " + startIndex + ")");
        context.emitGoto(startIndex);
        if (this.c2 != null) {
          breakJmp = context.getNextIndex();
          logging.debug("ForStatement: Configuring BranchEq instruction to jump to instruction number " + breakJmp);
          branchEq.jmp = breakJmp;
        }
        context.evaluateBreaks();
        context.exitCodeScope();
      };

      return _Class;

    })(NodeBase);
    module.CodeStatement = (function(_super) {
      __extends(_Class, _super);

      function _Class(statementList) {
        _Class.__super__.constructor.call(this, statementList, "CodeStatement");
      }

      return _Class;

    })(ParentNodeBase);
    module.BreakStatement = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        _Class.__super__.constructor.call(this, 'BreakStatement');
      }

      _Class.prototype.scanPass5 = function(context) {
        context.emitBreak();
      };

      return _Class;

    })(NodeBase);
    module.DotMemberExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(base, id) {
        _Class.__super__.constructor.call(this, "DotMemberExpression");
        this.base = base;
        this.id = id;
      }

      _Class.prototype.scanPass2 = function() {
        this.base.scanPass2();
      };

      _Class.prototype.scanPass3 = function() {
        this.base.scanPass3();
      };

      _Class.prototype.scanPass4 = function(context) {
        var baseType;
        logging.debug("" + this.nodeType + " scanPass4");
        this.base.scanPass4(context);
        this.isStatic = this.base.type.actualType != null;
        if (this.isStatic) {
          logging.debug("" + this.nodeType + " scanPass4: This is a static member expression");
        }
        baseType = this.isStatic ? this.base.type.actualType : this.base.type;
        logging.debug("" + this.nodeType + " scanPass4: Finding member '" + this.id + "' in base type " + baseType.name);
        this.value = baseType.findValue(this.id);
        this.type = this.value.type;
        logging.debug("" + this.nodeType + " scanPass4: Member type is " + this.type.name);
        return this.type;
      };

      _Class.prototype.scanPass5 = function(context) {
        logging.debug("" + this.nodeType + " scanPass5");
        if (!this.isStatic) {
          logging.debug("" + this.nodeType + " scanPass5: Scanning base expression");
          this.base.scanPass5(context);
          this.ri = this.base.ri;
        }
      };

      return _Class;

    })(NodeBase);
    module.PostfixExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(base, operator) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        _Class.__super__.constructor.call(this, "PostfixExpression", "variable");
        this.exp = base;
        this.op = operator;
      }

      _Class.prototype.scanPass4 = function(context) {
        this.exp.scanPass4(context);
        return this.type = this.op.check(this.exp);
      };

      _Class.prototype.scanPass5 = function(context) {
        this.exp.scanPass5(context);
        this.ri = context.allocRegister();
        return this.op.emit(context, this.exp.ri, this.ri, this.exp.value.isContextGlobal);
      };

      return _Class;

    })(NodeBase);
    module.ArraySub = (function(_super) {
      __extends(_Class, _super);

      function _Class(exp) {
        _Class.__super__.constructor.call(this, "ArraySub");
        this.exp = exp;
      }

      _Class.prototype.scanPass4 = function(context) {
        logging.debug("" + this.nodeType + " scanPass4");
        return this.exp.scanPass4(context);
      };

      _Class.prototype.scanPass5 = function(context) {
        logging.debug("" + this.nodeType + ": Emitting array indices");
        this.exp.scanPass5(context);
        this.expressions = this.exp.expressions;
        return this.ri = this.exp.ri;
      };

      _Class.prototype.getCount = function() {
        if (this.exp) {
          return this.exp.getCount();
        } else {
          return 0;
        }
      };

      return _Class;

    })(NodeBase);
    module.PrimaryArrayExpression = PrimaryArrayExpression = (function(_super) {
      __extends(PrimaryArrayExpression, _super);

      function PrimaryArrayExpression(exp) {
        this.exp = exp;
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        PrimaryArrayExpression.__super__.constructor.call(this, "PrimaryArrayExpression");
      }

      PrimaryArrayExpression.prototype.scanPass4 = function(context) {
        var type;
        logging.debug("" + this.nodeType + " scanPass4");
        type = this.exp.scanPass4(context);
        return this.type = new typesModule.ChuckType(type.name, typesModule["@array"]);
      };

      PrimaryArrayExpression.prototype.scanPass5 = function(context) {
        var e, registers;
        logging.debug("" + this.nodeType + " scanPass5");
        this.exp.scanPass5(context);
        registers = (function() {
          var _i, _len, _ref, _results;
          _ref = this.exp.expressions;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            e = _ref[_i];
            _results.push(e.ri);
          }
          return _results;
        }).call(this);
        this.ri = context.allocRegister();
        return context.emitArrayInit(this.exp.type, registers, this.ri);
      };

      return PrimaryArrayExpression;

    })(NodeBase);
    module.FunctionDefinition = FunctionDefinition = (function(_super) {
      __extends(FunctionDefinition, _super);

      function FunctionDefinition(funcDecl, staticDecl, typeDecl, name, args, code) {
        this.funcDecl = funcDecl;
        this.staticDecl = staticDecl;
        this.typeDecl = typeDecl;
        this.name = name;
        this.args = args;
        this.code = code;
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        FunctionDefinition.__super__.constructor.call(this, "FunctionDefinition");
      }

      FunctionDefinition.prototype.scanPass2 = function(context) {
        var arg, i, _i, _len, _ref;
        logging.debug("" + this.nodeType + " scanPass2");
        this.retType = context.findType(this.typeDecl.type);
        logging.debug("" + this.nodeType + " scanPass3: Return type determined as " + this.retType.name);
        _ref = this.args;
        for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
          arg = _ref[i];
          arg.type = context.findType(arg.typeDecl.type);
          logging.debug("" + this.nodeType + " scanPass3: Type of argument " + i + " determined as " + arg.type.name);
        }
        context.enterFunctionScope();
        this.code.scanPass2(context);
        context.exitFunctionScope();
      };

      FunctionDefinition.prototype.scanPass3 = function(context) {
        var arg, func, i, value, _i, _len, _ref;
        logging.debug("" + this.nodeType + " scanPass3");
        func = context.addFunction(this);
        this._ckFunc = func;
        context.enterFunctionScope();
        _ref = this.args;
        for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
          arg = _ref[i];
          logging.debug("" + this.nodeType + ": Creating value for argument " + i + " (" + arg.varDecl.name + ")");
          value = context.createValue(arg.type, arg.varDecl.name);
          value.offset = func.stackDepth;
          arg.varDecl.value = value;
        }
        this.code.scanPass3(context);
        context.exitFunctionScope();
      };

      FunctionDefinition.prototype.scanPass4 = function(context) {
        var arg, i, value, _i, _len, _ref;
        logging.debug("" + this.nodeType + " scanPass4");
        context.enterFunctionScope();
        _ref = this.args;
        for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
          arg = _ref[i];
          value = arg.varDecl.value;
          logging.debug("" + this.nodeType + " scanPass4: Adding parameter " + i + " (" + value.name + ") to function's scope");
          context.addValue(value);
        }
        this.code.scanPass4(context);
        context.exitFunctionScope();
      };

      FunctionDefinition.prototype.scanPass5 = function(context) {
        var arg, i, local, value, _i, _len, _ref;
        logging.debug("" + this.nodeType + " emitting");
        logging.debug("" + this.nodeType + ": Emitting constant corresponding to function");
        local = context.allocateLocal(this._ckFunc.value.type, this._ckFunc.value, false);
        context.emitStoreConst(local.ri, this._ckFunc);
        context.pushCode("" + this._ckFunc.name + "( ... )");
        context.enterCodeScope();
        _ref = this.args;
        for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
          arg = _ref[i];
          value = arg.varDecl.value;
          logging.debug("" + this.nodeType + " scanPass5: Allocating local variable for parameter " + i + " (" + value.name + ")");
          local = context.allocateLocal(value.type, value, false);
        }
        this.code.scanPass5(context);
        context.exitCodeScope();
        context.emitFuncReturn();
        this._ckFunc.code = context.popCode();
      };

      return FunctionDefinition;

    })(NodeBase);
    module.Arg = Arg = (function(_super) {
      __extends(Arg, _super);

      function Arg(typeDecl, varDecl) {
        this.typeDecl = typeDecl;
        this.varDecl = varDecl;
        Arg.__super__.constructor.call(this, "Arg");
      }

      return Arg;

    })(NodeBase);
    return module;
  });

}).call(this);
