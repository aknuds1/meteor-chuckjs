(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty;

  define("chuck/scanner", ["chuck/nodes", "chuck/types", "chuck/instructions", "chuck/namespace", "chuck/logging", "chuck/libs/math", "chuck/libs/std", "chuck/libs/stk"], function(nodes, types, instructions, namespaceModule, logging, mathLib, stdLib, stkLib) {
    var ChuckCode, ChuckFrame, ChuckLocal, Scanner, ScanningContext, module;
    module = {};
    ChuckLocal = (function() {
      function ChuckLocal(size, offset, name, isContextGlobal) {
        this.size = size;
        this.offset = offset;
        this.name = name;
        this.isContextGlobal = isContextGlobal;
      }

      return ChuckLocal;

    })();
    ChuckFrame = (function() {
      function ChuckFrame() {
        this.currentOffset = 0;
        this.stack = [];
      }

      return ChuckFrame;

    })();
    ChuckCode = (function() {
      function ChuckCode() {
        this.getNextIndex = __bind(this.getNextIndex, this);
        this.finish = __bind(this.finish, this);
        this.allocateLocal = __bind(this.allocateLocal, this);
        this.append = __bind(this.append, this);
        this.popScope = __bind(this.popScope, this);
        this.pushScope = __bind(this.pushScope, this);
        this.instructions = [];
        this.frame = new ChuckFrame();
        this.pushScope();
      }

      ChuckCode.prototype.pushScope = function() {
        this.frame.stack.push(null);
      };

      ChuckCode.prototype.popScope = function() {
        while (this.frame.stack.length > 0 && (this.frame.stack[this.frame.stack.length - 1] != null)) {
          this.frame.stack.pop();
          --this.frame.currentOffset;
        }
        this.frame.stack.pop();
        logging.debug("After popping scope, current stack offset is " + this.frame.currentOffset);
      };

      ChuckCode.prototype.append = function(instruction) {
        this.instructions.push(instruction);
        return instruction;
      };

      ChuckCode.prototype.allocateLocal = function(type, value, isGlobal) {
        var local, scopeStr;
        local = new ChuckLocal(type.size, this.frame.currentOffset, value.name, isGlobal);
        scopeStr = this._isGlobal ? "global" : "function";
        logging.debug("Allocating local " + value.name + " of type " + type.name + " at offset " + local.offset + " (scope: " + scopeStr + ")");
        this.frame.currentOffset += 1;
        this.frame.stack.push(local);
        value.offset = local.offset;
        return local;
      };

      ChuckCode.prototype.finish = function() {
        var local, locals, stack;
        stack = this.frame.stack;
        locals = [];
        while (stack.length > 0 && (stack[stack.length - 1] != null)) {
          local = stack.pop();
          if (local != null) {
            this.frame.currentOffset -= local.size;
            locals.push(local);
          }
        }
        stack.pop();
        return locals;
      };

      ChuckCode.prototype.getNextIndex = function() {
        return this.instructions.length;
      };

      return ChuckCode;

    })();
    ScanningContext = (function() {
      function ScanningContext() {
        this._nextIndex = __bind(this._nextIndex, this);
        this._emitPreConstructor = __bind(this._emitPreConstructor, this);
        this.getCurrentOffset = __bind(this.getCurrentOffset, this);
        this.addFunction = __bind(this.addFunction, this);
        this.finishScanning = __bind(this.finishScanning, this);
        this.evaluateBreaks = __bind(this.evaluateBreaks, this);
        this.emitFuncReturn = __bind(this.emitFuncReturn, this);
        this.emitMemSetImm = __bind(this.emitMemSetImm, this);
        this.emitArrayInit = __bind(this.emitArrayInit, this);
        this.emitArrayAccess = __bind(this.emitArrayAccess, this);
        this.emitBreak = __bind(this.emitBreak, this);
        this.emitGoto = __bind(this.emitGoto, this);
        this.emitBranchEq = __bind(this.emitBranchEq, this);
        this.emitGack = __bind(this.emitGack, this);
        this.emitOpAtChuck = __bind(this.emitOpAtChuck, this);
        this.emitTimeAdvance = __bind(this.emitTimeAdvance, this);
        this.emitGtNumber = __bind(this.emitGtNumber, this);
        this.emitLtNumber = __bind(this.emitLtNumber, this);
        this.emitTimesNumber = __bind(this.emitTimesNumber, this);
        this.emitSubtractNumber = __bind(this.emitSubtractNumber, this);
        this.emitPostIncNumber = __bind(this.emitPostIncNumber, this);
        this.emitPreIncNumber = __bind(this.emitPreIncNumber, this);
        this.emitAddNumber = __bind(this.emitAddNumber, this);
        this.emitRegPushMe = __bind(this.emitRegPushMe, this);
        this.emitRegPushNow = __bind(this.emitRegPushNow, this);
        this.emitDivideNumber = __bind(this.emitDivideNumber, this);
        this.emitTimesNumber = __bind(this.emitTimesNumber, this);
        this.emitDotMemberFunc = __bind(this.emitDotMemberFunc, this);
        this.emitDotStaticFunc = __bind(this.emitDotStaticFunc, this);
        this.emitRegDupLast = __bind(this.emitRegDupLast, this);
        this.emitRegPushMem = __bind(this.emitRegPushMem, this);
        this.emitRegPushMemAddr = __bind(this.emitRegPushMemAddr, this);
        this.emitFuncCall = __bind(this.emitFuncCall, this);
        this.emitFuncCallStatic = __bind(this.emitFuncCallStatic, this);
        this.emitFuncCallMember = __bind(this.emitFuncCallMember, this);
        this.emitRegPushImm = __bind(this.emitRegPushImm, this);
        this.emitPopWord = __bind(this.emitPopWord, this);
        this.emitUGenUnlink = __bind(this.emitUGenUnlink, this);
        this.emitUGenLink = __bind(this.emitUGenLink, this);
        this.emitDac = __bind(this.emitDac, this);
        this.emitMinusAssign = __bind(this.emitMinusAssign, this);
        this.emitPlusAssign = __bind(this.emitPlusAssign, this);
        this.emitAssignment = __bind(this.emitAssignment, this);
        this.exitCodeScope = __bind(this.exitCodeScope, this);
        this.enterCodeScope = __bind(this.enterCodeScope, this);
        this.exitScope = __bind(this.exitScope, this);
        this.enterScope = __bind(this.enterScope, this);
        this.getNextIndex = __bind(this.getNextIndex, this);
        this.allocateLocal = __bind(this.allocateLocal, this);
        this.instantiateObject = __bind(this.instantiateObject, this);
        this.pushToContStack = __bind(this.pushToContStack, this);
        this.pushToBreakStack = __bind(this.pushToBreakStack, this);
        this.createValue = __bind(this.createValue, this);
        this.addValue = __bind(this.addValue, this);
        this.addConstant = __bind(this.addConstant, this);
        this.addVariable = __bind(this.addVariable, this);
        this.findValue = __bind(this.findValue, this);
        this.findType = __bind(this.findType, this);
        this.exitFunctionScope = __bind(this.exitFunctionScope, this);
        this.enterFunctionScope = __bind(this.enterFunctionScope, this);
        this.popCode = __bind(this.popCode, this);
        this.pushCode = __bind(this.pushCode, this);
        var k, lib, type, typeType, _i, _len, _ref, _ref1;
        this.code = new ChuckCode();
        this._globalNamespace = new namespaceModule.Namespace("global");
        _ref = [types, mathLib, stdLib, stkLib];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          lib = _ref[_i];
          _ref1 = lib.types;
          for (k in _ref1) {
            if (!__hasProp.call(_ref1, k)) continue;
            type = _ref1[k];
            this._globalNamespace.addType(type);
            typeType = _.extend({}, types.Class);
            typeType.actualType = type;
            this._globalNamespace.addVariable(type.name, typeType, type);
          }
        }
        this._globalNamespace.commit();
        this._namespaceStack = [this._globalNamespace];
        this._currentNamespace = this._globalNamespace;
        this._breakStack = [];
        this._contStack = [];
        this._codeStack = [];
        this._isGlobal = true;
        this._functionLevel = 0;
      }

      /**
      Replace code object while storing the old one on the stack.
      */


      ScanningContext.prototype.pushCode = function(name) {
        this.enterFunctionScope();
        logging.debug("Pushing code object");
        this._codeStack.push(this.code);
        this.code = new ChuckCode();
        this.code.name = name;
        return this.code;
      };

      /**
      Restore code object at the top of the stack.
      */


      ScanningContext.prototype.popCode = function() {
        var toReturn;
        logging.debug("Popping code object");
        toReturn = this.code;
        this.code = this._codeStack.pop();
        this._isGlobal = this._codeStack.length === 0;
        if (this._isGlobal) {
          logging.debug("Back at global scope");
        }
        this.exitFunctionScope();
        return toReturn;
      };

      ScanningContext.prototype.enterFunctionScope = function() {
        ++this._functionLevel;
        this._isGlobal = false;
        this.enterScope();
      };

      ScanningContext.prototype.exitFunctionScope = function() {
        this.exitScope();
        --this._functionLevel;
        this._isGlobal = this._functionLevel <= 0;
      };

      ScanningContext.prototype.findType = function(typeName) {
        var type;
        type = this._currentNamespace.findType(typeName);
        return type;
      };

      ScanningContext.prototype.findValue = function(name, climb) {
        var val;
        if (climb == null) {
          climb = false;
        }
        val = this._currentNamespace.findValue(name, climb);
        if (val != null) {
          return val;
        }
        return val = this._currentNamespace.findValue(name, true);
      };

      ScanningContext.prototype.addVariable = function(name, type) {
        return this._currentNamespace.addVariable(name, type, null, this._isGlobal);
      };

      ScanningContext.prototype.addConstant = function(name, type, value) {
        var scopeStr;
        scopeStr = this._isGlobal ? "global" : "function";
        logging.debug("Adding constant " + name + " (scope: " + scopeStr + ")");
        return this._currentNamespace.addConstant(name, type, value, this._isGlobal);
      };

      ScanningContext.prototype.addValue = function(value, name) {
        var scopeStr;
        scopeStr = this._isGlobal ? "global" : "function";
        logging.debug("Adding value " + name + " (scope: " + scopeStr + ")");
        return this._currentNamespace.addValue(value, name, this._isGlobal);
      };

      ScanningContext.prototype.createValue = function(type, name) {
        return new namespaceModule.ChuckValue(type, name, this._currentNamespace, this._isGlobal);
      };

      ScanningContext.prototype.pushToBreakStack = function(statement) {
        return this._breakStack.push(statement);
      };

      ScanningContext.prototype.pushToContStack = function(statement) {
        return this._contStack.push(statement);
      };

      ScanningContext.prototype.instantiateObject = function(type) {
        logging.debug("Emitting instantiation of object of type " + type.name + " along with preconstructor");
        this.code.append(instructions.instantiateObject(type));
        return this._emitPreConstructor(type);
      };

      ScanningContext.prototype.allocateLocal = function(type, value, emit) {
        var local, scopeStr;
        if (emit == null) {
          emit = true;
        }
        scopeStr = this._isGlobal ? "global" : "function";
        logging.debug("Allocating local (scope: " + scopeStr + ")");
        local = this.code.allocateLocal(type, value, this._isGlobal);
        if (emit) {
          logging.debug("Emitting AllocWord instruction");
          this.code.append(instructions.allocWord(local.offset, this._isGlobal));
        }
        return local;
      };

      ScanningContext.prototype.getNextIndex = function() {
        return this.code.getNextIndex();
      };

      ScanningContext.prototype.enterScope = function() {
        return this._currentNamespace.enterScope();
      };

      ScanningContext.prototype.exitScope = function() {
        return this._currentNamespace.exitScope();
      };

      ScanningContext.prototype.enterCodeScope = function() {
        logging.debug("Entering nested code scope");
        this.code.pushScope();
      };

      ScanningContext.prototype.exitCodeScope = function() {
        logging.debug("Exiting nested code scope");
        this.code.popScope();
      };

      ScanningContext.prototype.emitAssignment = function(type, varDecl) {
        var array, bottom, elemType, isObj, startIndex, top, value;
        value = varDecl.value, array = varDecl.array;
        if (array != null) {
          logging.debug("Emitting array indices");
          array.scanPass5(this);
          logging.debug("Emitting AllocateArray");
          this.code.append(instructions.allocateArray(type));
          elemType = type.arrayType;
          if (types.isObj(elemType)) {
            startIndex = this._nextIndex();
            logging.debug("Emitting PreCtorArrayTop");
            top = this.code.append(instructions.preCtorArrayTop(elemType));
            this._emitPreConstructor(elemType);
            logging.debug("Emitting PreCtorArrayBottom");
            bottom = this.code.append(instructions.preCtorArrayBottom(elemType));
            top.set(this._nextIndex());
            bottom.set(startIndex);
            this.code.append(instructions.preCtorArrayPost());
          }
        }
        isObj = types.isObj(type) || (array != null);
        if (isObj && (array == null) && !type.isRef) {
          this.instantiateObject(type);
        }
        this.allocateLocal(type, value);
        if (isObj && !type.isRef) {
          logging.debug("Emitting AssignObject");
          this.code.append(instructions.assignObject(false, this._isGlobal));
        }
      };

      ScanningContext.prototype.emitPlusAssign = function(isGlobal) {
        this.code.append(instructions.plusAssign(isGlobal));
      };

      ScanningContext.prototype.emitMinusAssign = function(isGlobal) {
        this.code.append(instructions.minusAssign(isGlobal));
      };

      ScanningContext.prototype.emitDac = function() {
        this.code.append(instructions.dac());
      };

      ScanningContext.prototype.emitUGenLink = function() {
        this.code.append(instructions.uGenLink());
      };

      ScanningContext.prototype.emitUGenUnlink = function() {
        this.code.append(instructions.uGenUnlink());
      };

      ScanningContext.prototype.emitPopWord = function() {
        this.code.append(instructions.popWord());
      };

      ScanningContext.prototype.emitRegPushImm = function(value) {
        this.code.append(instructions.regPushImm(value));
      };

      ScanningContext.prototype.emitFuncCallMember = function() {
        this.code.append(instructions.funcCallMember());
      };

      ScanningContext.prototype.emitFuncCallStatic = function() {
        this.code.append(instructions.funcCallStatic());
      };

      ScanningContext.prototype.emitFuncCall = function() {
        return this.code.append(instructions.funcCall());
      };

      ScanningContext.prototype.emitRegPushMemAddr = function(offset, isGlobal) {
        this.code.append(instructions.regPushMemAddr(offset, isGlobal));
      };

      ScanningContext.prototype.emitRegPushMem = function(offset, isGlobal) {
        this.code.append(instructions.regPushMem(offset, isGlobal));
      };

      ScanningContext.prototype.emitRegDupLast = function() {
        this.code.append(instructions.regDupLast());
      };

      ScanningContext.prototype.emitDotStaticFunc = function(func) {
        this.code.append(instructions.dotStaticFunc(func));
      };

      ScanningContext.prototype.emitDotMemberFunc = function(func) {
        this.code.append(instructions.dotMemberFunc(func));
      };

      ScanningContext.prototype.emitTimesNumber = function() {
        this.code.append(instructions.timesNumber());
      };

      ScanningContext.prototype.emitDivideNumber = function() {
        this.code.append(instructions.divideNumber());
      };

      ScanningContext.prototype.emitRegPushNow = function() {
        this.code.append(instructions.regPushNow());
      };

      ScanningContext.prototype.emitRegPushMe = function() {
        this.code.append(instructions.regPushMe());
      };

      ScanningContext.prototype.emitAddNumber = function() {
        this.code.append(instructions.addNumber());
      };

      ScanningContext.prototype.emitPreIncNumber = function(isGlobal) {
        return this.code.append(instructions.preIncNumber(isGlobal));
      };

      ScanningContext.prototype.emitPostIncNumber = function(isGlobal) {
        return this.code.append(instructions.postIncNumber(isGlobal));
      };

      ScanningContext.prototype.emitSubtractNumber = function() {
        this.code.append(instructions.subtractNumber());
      };

      ScanningContext.prototype.emitTimesNumber = function() {
        return this.code.append(instructions.timesNumber());
      };

      ScanningContext.prototype.emitLtNumber = function() {
        this.code.append(instructions.ltNumber());
      };

      ScanningContext.prototype.emitGtNumber = function() {
        this.code.append(instructions.gtNumber());
      };

      ScanningContext.prototype.emitTimeAdvance = function() {
        this.code.append(instructions.timeAdvance());
      };

      ScanningContext.prototype.emitOpAtChuck = function(isArray) {
        if (isArray == null) {
          isArray = false;
        }
        logging.debug("Emitting AssignObject (isArray: " + isArray + ")");
        this.code.append(instructions.assignObject(isArray, this._isGlobal));
      };

      ScanningContext.prototype.emitGack = function(types) {
        this.code.append(instructions.gack(types));
      };

      ScanningContext.prototype.emitBranchEq = function(jmp) {
        return this.code.append(instructions.branchEq(jmp));
      };

      ScanningContext.prototype.emitGoto = function(jmp) {
        return this.code.append(instructions.goto(jmp));
      };

      ScanningContext.prototype.emitBreak = function() {
        var instr;
        instr = instructions.goto();
        this.code.append(instr);
        return this._breakStack.push(instr);
      };

      ScanningContext.prototype.emitArrayAccess = function(type, emitAddr) {
        return this.code.append(instructions.arrayAccess(type, emitAddr));
      };

      ScanningContext.prototype.emitArrayInit = function(type, count) {
        return this.code.append(instructions.arrayInit(type, count));
      };

      ScanningContext.prototype.emitMemSetImm = function(offset, value, isGlobal) {
        return this.code.append(instructions.memSetImm(offset, value, isGlobal));
      };

      ScanningContext.prototype.emitFuncReturn = function() {
        return this.code.append(instructions.funcReturn());
      };

      ScanningContext.prototype.evaluateBreaks = function() {
        var instr;
        while (this._breakStack.length) {
          instr = this._breakStack.pop();
          instr.jmp = this._nextIndex();
        }
      };

      ScanningContext.prototype.finishScanning = function() {
        var local, locals, _i, _len;
        locals = this.code.finish();
        for (_i = 0, _len = locals.length; _i < _len; _i++) {
          local = locals[_i];
          this.code.append(instructions.releaseObject2(local.offset, local.isContextGlobal));
        }
        this.code.append(instructions.eoc());
      };

      ScanningContext.prototype.addFunction = function(funcDef) {
        var arg, args, func, funcArg, funcGroup, name, type, value, _i, _len, _ref;
        value = this.findValue(funcDef.name);
        if (value != null) {
          funcGroup = value.value;
          logging.debug("Found corresponding function group " + funcDef.name);
        } else {
          logging.debug("Creating function group " + funcDef.name);
          type = new types.ChuckType("[function]", types.types.Function);
          funcGroup = new types.ChuckFunction(funcDef.name, [], funcDef.retType);
          type.func = funcGroup;
          funcGroup.value = this.addConstant(funcGroup.name, type, funcGroup);
        }
        name = "" + funcDef.name + "@" + (funcGroup.getNumberOfOverloads()) + "@" + (this._currentNamespace.name || '');
        logging.debug("Adding function " + name);
        args = [];
        _ref = funcDef.args;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          arg = _ref[_i];
          funcArg = new types.FuncArg(arg.varDecl.name, types.types[arg.typeDecl.type]);
          logging.debug("Adding function argument " + funcArg.name + " of type " + funcArg.type.name);
          args.push(funcArg);
        }
        func = new types.FunctionOverload(args, null, false, name);
        funcGroup.addOverload(func);
        func.value = this.addConstant(name, funcGroup.value.type, func);
        return func;
      };

      ScanningContext.prototype.getCurrentOffset = function() {
        return this.code.frame.currentOffset;
      };

      ScanningContext.prototype._emitPreConstructor = function(type) {
        if (type.parent != null) {
          this._emitPreConstructor(type.parent);
        }
        if (type.hasConstructor) {
          this.code.append(instructions.preConstructor(type, this.getCurrentOffset()));
        }
      };

      ScanningContext.prototype._nextIndex = function() {
        return this.code.instructions.length;
      };

      return ScanningContext;

    })();
    Scanner = (function() {
      function Scanner(ast) {
        this._pass = __bind(this._pass, this);
        this.pass5 = __bind(this.pass5, this);
        this.pass4 = __bind(this.pass4, this);
        this.pass3 = __bind(this.pass3, this);
        this.pass2 = __bind(this.pass2, this);
        this.pass1 = __bind(this.pass1, this);
        this._ast = ast;
        this._context = new ScanningContext();
      }

      Scanner.prototype.pass1 = function() {
        return this._pass(1);
      };

      Scanner.prototype.pass2 = function() {
        return this._pass(2);
      };

      Scanner.prototype.pass3 = function() {
        return this._pass(3);
      };

      Scanner.prototype.pass4 = function() {
        return this._pass(4);
      };

      Scanner.prototype.pass5 = function() {
        this._pass(5);
        this._context.finishScanning();
        return this.byteCode = this._context.code.instructions;
      };

      Scanner.prototype._pass = function(num) {
        var program;
        program = this._ast;
        return program["scanPass" + num](this._context);
      };

      return Scanner;

    })();
    module.scan = function(ast) {
      var scanner;
      scanner = new Scanner(ast);
      logging.debug("Scan pass 1");
      scanner.pass1();
      logging.debug("Scan pass 2");
      scanner.pass2();
      logging.debug("Scan pass 3");
      scanner.pass3();
      logging.debug("Scan pass 4");
      scanner.pass4();
      logging.debug("Scan pass 5");
      scanner.pass5();
      return scanner.byteCode;
    };
    return module;
  });

}).call(this);
