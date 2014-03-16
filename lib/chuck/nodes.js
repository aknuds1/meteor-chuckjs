(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  define("chuck/nodes", ["chuck/types", "chuck/logging", "chuck/audioContextService"], function(typesModule, logging, audioContextService) {
    var AdditiveSubtractiveOperatorBase, ExpressionBase, ExpressionList, GtLtOperatorBase, NodeBase, ParentNodeBase, PlusPlusOperatorBase, TimesOperator, module, types;
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
        if (_(this._child).isArray()) {
          return this._scanArray(this._child, pass, context);
        } else {
          return this._child["scanPass" + pass](context);
        }
      };

      ParentNodeBase.prototype._scanArray = function(array, pass, context) {
        var c, _i, _len;
        for (_i = 0, _len = array.length; _i < _len; _i++) {
          c = array[_i];
          if (_(c).isArray()) {
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
        this.scanPass5 = __bind(this.scanPass5, this);
        _Class.__super__.constructor.call(this, exp, "ExpressionStatement");
      }

      _Class.prototype.scanPass5 = function(context, opts) {
        var shouldPop;
        opts = opts || {};
        shouldPop = opts.pop != null ? opts.pop : true;
        this._child.scanPass5(context);
        if ((this._child.type != null) && this._child.type.size > 0) {
          if (shouldPop) {
            logging.debug("ExpressionStatement: Emitting PopWord to remove superfluous return value");
            return context.emitPopWord();
          }
        } else {
          return logging.debug("ExpressionStatement: Child expression has no return value");
        }
      };

      return _Class;

    })(ParentNodeBase);
    module.BinaryExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(exp1, operator, exp2) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
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
      };

      return _Class;

    })(NodeBase);
    ExpressionBase = (function(_super) {
      __extends(ExpressionBase, _super);

      function ExpressionBase(nodeType, meta) {
        this.scanPass4 = __bind(this.scanPass4, this);
        ExpressionBase.__super__.constructor.call(this, nodeType);
        this._meta = meta;
      }

      ExpressionBase.prototype.scanPass4 = function() {
        this.groupSize = 0;
        return ++this.groupSize;
      };

      return ExpressionBase;

    })(NodeBase);
    module.ExpressionList = ExpressionList = (function(_super) {
      __extends(ExpressionList, _super);

      function ExpressionList(expression) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this._scanPass = __bind(this._scanPass, this);
        this.prepend = __bind(this.prepend, this);
        ExpressionList.__super__.constructor.call(this, "ExpressionList");
        this._expressions = [expression];
      }

      ExpressionList.prototype.prepend = function(expression) {
        this._expressions.splice(0, 0, expression);
        return this;
      };

      ExpressionList.prototype._scanPass = function(pass) {
        var exp, _i, _len, _ref;
        _ref = this._expressions;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          exp = _ref[_i];
          exp["scanPass" + pass].apply(exp, Array.prototype.slice.call(arguments, 1));
        }
      };

      ExpressionList.prototype.scanPass1 = _.partial(ExpressionList.prototype._scanPass, 1);

      ExpressionList.prototype.scanPass2 = _.partial(ExpressionList.prototype._scanPass, 2);

      ExpressionList.prototype.scanPass3 = _.partial(ExpressionList.prototype._scanPass, 3);

      ExpressionList.prototype.scanPass4 = _.partial(ExpressionList.prototype._scanPass, 4);

      ExpressionList.prototype.scanPass5 = function(context) {
        var exp;
        this._scanPass(5, context);
        return this.types = (function() {
          var _i, _len, _ref, _results;
          _ref = this._expressions;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            exp = _ref[_i];
            _results.push(exp.type);
          }
          return _results;
        }).call(this);
      };

      return ExpressionList;

    })(ExpressionBase);
    module.DeclarationExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(typeDecl, varDecls) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        _Class.__super__.constructor.call(this, "DeclarationExpression");
        this.typeDecl = typeDecl;
        this.varDecls = varDecls;
      }

      _Class.prototype.scanPass2 = function(context) {
        this.type = context.findType(this.typeDecl.type);
        logging.debug("Variable declaration of type " + this.type.name);
        return void 0;
      };

      _Class.prototype.scanPass3 = function(context) {
        var varDecl, _i, _len, _ref;
        _ref = this.varDecls;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          varDecl = _ref[_i];
          logging.debug("Adding variable '" + varDecl.name + "' of type " + this.type.name + " to current namespace");
          varDecl.value = context.addVariable(varDecl.name, this.type);
        }
        return void 0;
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
            logging.debug("" + this.nodeType + ": Instantiating array", varDecl);
          } else {
            logging.debug("" + this.nodeType + ": Emitting Assignment for value " + varDecl.value);
          }
        }
        context.emitAssignment(this.type, varDecl);
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
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        _Class.__super__.constructor.call(this, "PrimaryVariableExpression", "variable");
        this.name = name;
        this._emitVar = false;
      }

      _Class.prototype.scanPass4 = function(context) {
        _Class.__super__.scanPass4.call(this);
        switch (this.name) {
          case "dac":
            this._meta = "value";
            this.type = types.Dac;
            break;
          case "second":
            this.type = types.Dur;
            break;
          case "now":
            this.type = types.Time;
            break;
          case "true":
            this._meta = "value";
            return this.type = types.int;
          default:
            this.value = context.findValue(this.name);
            if (this.value == null) {
              context.findValue(this.name, true);
            }
            this.type = this.value.type;
            logging.debug("Primary variable of type " + this.type.name);
            return this.type;
        }
      };

      _Class.prototype.scanPass5 = function(context) {
        _Class.__super__.scanPass5.call(this);
        switch (this.name) {
          case "dac":
            context.emitDac();
            break;
          case "second":
            context.emitRegPushImm(audioContextService.getSampleRate());
            break;
          case "now":
            context.emitRegPushNow();
            break;
          case "true":
            context.emitRegPushImm(1);
            break;
          default:
            if (this._emitVar) {
              logging.debug("" + this.nodeType + ": Emitting RegPushMemAddr (" + this.value.offset + ") since this is a variable");
              context.emitRegPushMemAddr(this.value.offset);
            } else {
              logging.debug("" + this.nodeType + ": Emitting RegPushMem (" + this.value.offset + ") since this is a constant");
              context.emitRegPushMem(this.value.offset);
            }
        }
        return void 0;
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
        logging.debug("" + this.nodeType + ": Emitting RegPushImm(" + this.value + ")");
        return context.emitRegPushImm(this.value);
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
        return context.emitRegPushImm(this.value);
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
        return this.expression.scanPass4(context);
      };

      _Class.prototype.scanPass5 = function(context) {
        var t;
        _Class.__super__.scanPass5.call(this);
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
        return context.emitGack(this.expression.types);
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
        return context.emitRegPushImm(this.value);
      };

      return _Class;

    })(ExpressionBase);
    module.PrimaryArrayExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(base, indices) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        this.scanPass1 = __bind(this.scanPass1, this);
        _Class.__super__.constructor.call(this, "PrimaryArrayExpression", "variable");
        this.base = base;
        this.indices = indices;
      }

      _Class.prototype.scanPass1 = function() {
        _Class.__super__.scanPass1.call(this);
        this.base.scanPass1();
        return this.indices.scanPass1();
      };

      _Class.prototype.scanPass2 = function() {
        _Class.__super__.scanPass2.call(this);
        this.base.scanPass2();
        return this.indices.scanPass2();
      };

      _Class.prototype.scanPass3 = function() {
        _Class.__super__.scanPass3.call(this);
        this.base.scanPass3();
        return this.indices.scanPass3();
      };

      _Class.prototype.scanPass4 = function(context) {
        var baseType;
        _Class.__super__.scanPass4.call(this, context);
        logging.debug("" + this.nodeType + " scanPass4: Base");
        baseType = this.base.scanPass4(context);
        logging.debug("" + this.nodeType + " scanPass4: Indices");
        this.indices.scanPass4(context);
        logging.debug("" + this.nodeType + " scanPass4: Type determined to be " + baseType.name);
        return this.type = baseType;
      };

      _Class.prototype.scanPass5 = function(context) {
        logging.debug("" + this.nodeType + " emitting");
        _Class.__super__.scanPass5.call(this, context);
        this.base.scanPass5(context);
        this.indices.scanPass5(context);
        logging.debug("" + this.nodeType + ": Emitting ArrayAccess (as variable: " + this._emitVar + ")");
        return context.emitArrayAccess(this.type, this._emitVar);
      };

      return _Class;

    })(ExpressionBase);
    module.FuncCallExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(base, args) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        this.scanPass1 = __bind(this.scanPass1, this);
        _Class.__super__.constructor.call(this, "FuncCallExpression");
        this.func = base;
        this.args = args;
      }

      _Class.prototype.scanPass1 = function() {
        _Class.__super__.scanPass1.call(this);
        this.func.scanPass1();
        if (this.args != null) {
          return this.args.scanPass1();
        }
      };

      _Class.prototype.scanPass2 = function() {
        _Class.__super__.scanPass2.call(this);
        this.func.scanPass2();
        if (this.args != null) {
          return this.args.scanPass2();
        }
      };

      _Class.prototype.scanPass3 = function() {
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
        this._ckFunc = funcGroup.findOverload(this.args._expressions);
        this.type = funcGroup.retType;
        logging.debug("" + this.nodeType + " scanPass4: Got function overload " + this._ckFunc.name + " with return type " + this.type.name);
        return this.type;
      };

      _Class.prototype.scanPass5 = function(context) {
        _Class.__super__.scanPass5.call(this, context);
        if (this.args != null) {
          logging.debug("" + this.nodeType + ": Emitting arguments");
          this.args.scanPass5(context);
        }
        logging.debug("" + this.nodeType + ": Emitting function " + this._ckFunc.name);
        context.emitDotStaticFunc(this._ckFunc);
        context.emitRegPushImm(0);
        if (this._ckFunc.isMember) {
          logging.debug("" + this.nodeType + ": Emitting instance method call");
          return context.emitFuncCallMember();
        } else {
          logging.debug("" + this.nodeType + ": Emitting static method call");
          return context.emitFuncCallStatic();
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

      _Class.prototype.scanPass2 = function() {
        _Class.__super__.scanPass2.call(this);
        logging.debug('DurExpression');
        this.base.scanPass2();
        return this.unit.scanPass2();
      };

      _Class.prototype.scanPass3 = function() {
        _Class.__super__.scanPass3.call(this);
        this.base.scanPass3();
        return this.unit.scanPass3();
      };

      _Class.prototype.scanPass4 = function() {
        _Class.__super__.scanPass4.call(this);
        this.type = types.Dur;
        this.base.scanPass4();
        return this.unit.scanPass4();
      };

      _Class.prototype.scanPass5 = function(context) {
        _Class.__super__.scanPass5.call(this);
        this.base.scanPass5(context);
        this.unit.scanPass5(context);
        return context.emitTimesNumber();
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
        this.op.emit(context);
      };

      return _Class;

    })(ExpressionBase);
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
        if (lhs.type === types.Dur && rhs.type === types.Time && rhs.name === "now") {
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
      };

      _Class.prototype.emit = function(context, lhs, rhs) {
        var isArray;
        if (lhs.type.isOfType(types.UGen) && rhs.type.isOfType(types.UGen)) {
          context.emitUGenLink();
        } else if (lhs.type.isOfType(types.Dur) && rhs.type.isOfType(types.Time)) {
          context.emitAddNumber();
          if (rhs.name === "now") {
            context.emitTimeAdvance();
          }
        } else if (rhs.type.isOfType(types.Function)) {
          context.emitRegPushImm(8);
          context.emitFuncCallMember();
        } else if (lhs.type.isOfType(rhs.type)) {
          isArray = rhs.indices != null;
          if (!isArray) {
            logging.debug("ChuckOperator emitting OpAtChuck to assign one object to another");
          } else {
            logging.debug("ChuckOperator emitting OpAtChuck to assign an object to an array element");
          }
          return context.emitOpAtChuck(isArray);
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
          context.emitUGenUnlink();
        }
      };

      return _Class;

    })();
    AdditiveSubtractiveOperatorBase = (function() {
      function AdditiveSubtractiveOperatorBase() {
        this.check = __bind(this.check, this);
      }

      AdditiveSubtractiveOperatorBase.prototype.check = function(lhs, rhs) {
        if ((lhs.type === types.Dur && rhs.type === types.Time) || (lhs.type === types.Time && rhs.type === types.Dur)) {
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
        this.emit = __bind(this.emit, this);
        this.name = "PlusOperator";
      }

      _Class.prototype.emit = function(context, lhs, rhs) {
        logging.debug('PlusOperator emitting AddNumber');
        return context.emitAddNumber();
      };

      return _Class;

    })(AdditiveSubtractiveOperatorBase);
    PlusPlusOperatorBase = (function() {
      function _Class(name) {
        this.check = __bind(this.check, this);
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
        this.emit = __bind(this.emit, this);
        _Class.__super__.constructor.call(this, "PrefixPlusPlusOperator");
      }

      _Class.prototype.emit = function(context) {
        logging.debug("" + this.name + " emitting PreIncNumber");
        return context.emitPreIncNumber();
      };

      return _Class;

    })(PlusPlusOperatorBase);
    module.PostfixPlusPlusOperator = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        this.emit = __bind(this.emit, this);
        _Class.__super__.constructor.call(this, "PostfixPlusPlusOperator");
      }

      _Class.prototype.emit = function(context) {
        logging.debug("" + this.name + " emitting PostIncNumber");
        return context.emitPostIncNumber();
      };

      return _Class;

    })(PlusPlusOperatorBase);
    module.MinusOperator = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        this.emit = __bind(this.emit, this);
        this.name = "MinusOperator";
      }

      _Class.prototype.emit = function(context, lhs, rhs) {
        logging.debug('MinusOperator emitting SubtractNumber');
        return context.emitSubtractNumber();
      };

      return _Class;

    })(AdditiveSubtractiveOperatorBase);
    module.MinusMinusOperator = (function() {
      function _Class() {
        this.name = "MinusMinusOperator";
      }

      return _Class;

    })();
    module.TimesOperator = TimesOperator = (function() {
      function TimesOperator() {
        this.emit = __bind(this.emit, this);
        this.check = __bind(this.check, this);
        this.name = "TimesOperator";
      }

      TimesOperator.prototype.check = function(lhs, rhs, context) {
        if (lhs.type === types.float && rhs.type === types.float) {
          return types.float;
        }
      };

      TimesOperator.prototype.emit = function(context) {
        return context.emitTimesNumber();
      };

      return TimesOperator;

    })();
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

      _Class.prototype.emit = function(context) {
        logging.debug("LtOperator: Emitting");
        return context.emitLtNumber();
      };

      return _Class;

    })(GtLtOperatorBase);
    module.GtOperator = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        this.emit = __bind(this.emit, this);
        this.name = "GtOperator";
      }

      _Class.prototype.emit = function(context) {
        logging.debug("GtOperator: Emitting");
        return context.emitGtNumber();
      };

      return _Class;

    })(GtLtOperatorBase);
    module.WhileStatement = (function(_super) {
      __extends(_Class, _super);

      function _Class(cond, body) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        this.scanPass1 = __bind(this.scanPass1, this);
        _Class.__super__.constructor.call(this, "WhileStatement");
        this.condition = cond;
        this.body = body;
      }

      _Class.prototype.scanPass1 = function() {
        this.condition.scanPass1();
        this.body.scanPass1();
      };

      _Class.prototype.scanPass2 = function() {
        this.condition.scanPass2();
        this.body.scanPass2();
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
        var branchEq, breakJmp, startIndex;
        startIndex = context.getNextIndex();
        this.condition.scanPass5(context);
        context.emitRegPushImm(false);
        logging.debug("WhileStatement: Emitting BranchEq");
        branchEq = context.emitBranchEq();
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
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
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
        context.emitScopeEntrance();
        logging.debug("" + this.nodeType + ": Emitting the initial");
        this.c1.scanPass5(context);
        startIndex = context.getNextIndex();
        logging.debug("" + this.nodeType + ": Emitting the condition");
        this.c2.scanPass5(context, {
          pop: false
        });
        context.emitRegPushImm(false);
        logging.debug("" + this.nodeType + ": Emitting BranchEq");
        branchEq = context.emitBranchEq();
        context.emitScopeEntrance();
        logging.debug("" + this.nodeType + ": Emitting the body");
        this.body.scanPass5(context);
        context.emitScopeExit();
        if (this.c3 != null) {
          logging.debug("" + this.nodeType + ": Emitting the post");
          this.c3.scanPass5(context);
          context.emitPopWord();
        }
        logging.debug("ForStatement: Emitting GoTo (instruction number " + startIndex + ")");
        context.emitGoto(startIndex);
        if (this.c2 != null) {
          breakJmp = context.getNextIndex();
          logging.debug("ForStatement: Configuring BranchEq instruction to jump to instruction number " + breakJmp);
          branchEq.jmp = breakJmp;
        }
        context.evaluateBreaks();
        context.emitScopeExit();
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
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
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
        var baseStatic, baseType;
        logging.debug("" + this.nodeType + " scanPass4");
        this.base.scanPass4(context);
        baseStatic = this.base.type.actualType != null;
        if (baseStatic) {
          logging.debug("" + this.nodeType + " scanPass4: This is a static member expression");
        }
        baseType = baseStatic ? this.base.type.actualType : this.base.type;
        logging.debug("" + this.nodeType + " scanPass4: Finding member '" + this.id + "' in base type " + baseType.name);
        this.value = baseType.findValue(this.id);
        this.type = this.value.type;
        logging.debug("" + this.nodeType + " scanPass4: Member type is " + this.type.name);
        return this.type;
      };

      _Class.prototype.scanPass5 = function(context) {
        this.base.scanPass5(context);
        context.emitRegDupLast();
        context.emitDotMemberFunc(this._ckFunc);
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
        return this.op.emit(context);
      };

      return _Class;

    })(NodeBase);
    module.ArraySub = (function(_super) {
      __extends(_Class, _super);

      function _Class(exp) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        _Class.__super__.constructor.call(this, "ArraySub");
        this.exp = exp;
      }

      _Class.prototype.scanPass4 = function(context) {
        logging.debug("" + this.nodeType + " scanPass4");
        return this.exp.scanPass4(context);
      };

      _Class.prototype.scanPass5 = function(context) {
        logging.debug("" + this.nodeType + ": Emitting array indices");
        return this.exp.scanPass5(context);
      };

      return _Class;

    })(NodeBase);
    return module;
  });

}).call(this);
