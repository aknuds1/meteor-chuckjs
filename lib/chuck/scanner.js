(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty;

  define("chuck/scanner", ["chuck/nodes", "chuck/types", "chuck/instructions", "chuck/namespace", "chuck/logging", "chuck/libs/math"], function(nodes, types, instructions, namespaceModule, logging, mathLib) {
    var ChuckCode, ChuckFrame, ChuckLocal, Scanner, ScanningContext, module;
    module = {};
    ChuckLocal = (function() {
      function ChuckLocal(size, offset, name) {
        this.size = size;
        this.offset = offset;
        this.name = name;
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

      ChuckCode.prototype.allocateLocal = function(type, value) {
        var local;
        local = new ChuckLocal(type.size, this.frame.currentOffset, value.name);
        logging.debug("Allocating local " + value.name + " of type " + type.name + " at offset " + local.offset);
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
        this.finishScanning = __bind(this.finishScanning, this);
        this.evaluateBreaks = __bind(this.evaluateBreaks, this);
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
        this.emitRegPushNow = __bind(this.emitRegPushNow, this);
        this.emitTimesNumber = __bind(this.emitTimesNumber, this);
        this.emitDotStaticFunc = __bind(this.emitDotStaticFunc, this);
        this.emitDotMemberFunc = __bind(this.emitDotMemberFunc, this);
        this.emitRegDupLast = __bind(this.emitRegDupLast, this);
        this.emitRegPushMem = __bind(this.emitRegPushMem, this);
        this.emitRegPushMemAddr = __bind(this.emitRegPushMemAddr, this);
        this.emitFuncCallStatic = __bind(this.emitFuncCallStatic, this);
        this.emitFuncCallMember = __bind(this.emitFuncCallMember, this);
        this.emitRegPushImm = __bind(this.emitRegPushImm, this);
        this.emitPopWord = __bind(this.emitPopWord, this);
        this.emitUGenUnlink = __bind(this.emitUGenUnlink, this);
        this.emitUGenLink = __bind(this.emitUGenLink, this);
        this.emitDac = __bind(this.emitDac, this);
        this.emitMinusAssign = __bind(this.emitMinusAssign, this);
        this.emitAssignment = __bind(this.emitAssignment, this);
        this.emitScopeExit = __bind(this.emitScopeExit, this);
        this.emitScopeEntrance = __bind(this.emitScopeEntrance, this);
        this.exitScope = __bind(this.exitScope, this);
        this.enterScope = __bind(this.enterScope, this);
        this.getNextIndex = __bind(this.getNextIndex, this);
        this.allocateLocal = __bind(this.allocateLocal, this);
        this.instantiateObject = __bind(this.instantiateObject, this);
        this.pushToContStack = __bind(this.pushToContStack, this);
        this.pushToBreakStack = __bind(this.pushToBreakStack, this);
        this.addValue = __bind(this.addValue, this);
        this.addVariable = __bind(this.addVariable, this);
        this.findValue = __bind(this.findValue, this);
        this.findType = __bind(this.findType, this);
        var k, lib, type, typeType, _i, _len, _ref, _ref1;
        this.code = new ChuckCode();
        this._globalNamespace = new namespaceModule.Namespace("global");
        _ref = [types, mathLib];
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
      }

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

      ScanningContext.prototype.addVariable = function(name, typeName) {
        return this._currentNamespace.addVariable(name, typeName);
      };

      ScanningContext.prototype.addValue = function(value) {
        return this._currentNamespace.addValue(value);
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

      ScanningContext.prototype.allocateLocal = function(type, value) {
        var local;
        logging.debug("Allocating local");
        logging.debug("Emitting AllocWord instruction");
        local = this.code.allocateLocal(type, value);
        return this.code.append(instructions.allocWord(local.offset));
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

      ScanningContext.prototype.emitScopeEntrance = function() {
        logging.debug("Emitting entrance of nested scope");
        this.code.pushScope();
      };

      ScanningContext.prototype.emitScopeExit = function() {
        logging.debug("Emitting exit of nested scope");
        this.code.popScope();
      };

      ScanningContext.prototype.emitAssignment = function(type, varDecl) {
        var array, bottom, isObj, startIndex, top, value;
        value = varDecl.value, array = varDecl.array;
        if (array != null) {
          logging.debug("Emitting array indices");
          array.scanPass5(this);
          logging.debug("Emitting AllocateArray");
          this.code.append(instructions.allocateArray(type));
          if (types.isObj(type)) {
            startIndex = this._nextIndex();
            logging.debug("Emitting PreCtorArrayTop");
            top = this.code.append(instructions.preCtorArrayTop(type));
            this._emitPreConstructor(type);
            logging.debug("Emitting PreCtorArrayBottom");
            bottom = this.code.append(instructions.preCtorArrayBottom(type));
            top.set(this._nextIndex());
            bottom.set(startIndex);
            this.code.append(instructions.preCtorArrayPost());
          }
        }
        isObj = types.isObj(type) || (array != null);
        if (isObj && (array == null)) {
          this.instantiateObject(type);
        }
        this.allocateLocal(type, value);
        if (isObj) {
          logging.debug("Emitting AssignObject");
          this.code.append(instructions.assignObject());
        }
      };

      ScanningContext.prototype.emitMinusAssign = function() {
        this.code.append(instructions.minusAssign());
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

      ScanningContext.prototype.emitRegPushMemAddr = function(offset) {
        this.code.append(instructions.regPushMemAddr(offset));
      };

      ScanningContext.prototype.emitRegPushMem = function(offset) {
        this.code.append(instructions.regPushMem(offset));
      };

      ScanningContext.prototype.emitRegDupLast = function() {
        this.code.append(instructions.regDupLast());
      };

      ScanningContext.prototype.emitDotMemberFunc = function(func) {
        this.code.append(instructions.dotMemberFunc(func));
      };

      ScanningContext.prototype.emitDotStaticFunc = function(func) {
        this.code.append(instructions.dotStaticFunc(func));
      };

      ScanningContext.prototype.emitTimesNumber = function() {
        this.code.append(instructions.timesNumber());
      };

      ScanningContext.prototype.emitRegPushNow = function() {
        this.code.append(instructions.regPushNow());
      };

      ScanningContext.prototype.emitAddNumber = function() {
        this.code.append(instructions.addNumber());
      };

      ScanningContext.prototype.emitPreIncNumber = function() {
        return this.code.append(instructions.preIncNumber());
      };

      ScanningContext.prototype.emitPostIncNumber = function() {
        return this.code.append(instructions.postIncNumber());
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
        logging.debug("Emitting AssignObject (isArray: " + isArray + ")");
        this.code.append(instructions.assignObject(isArray));
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
          this.code.append(instructions.releaseObject2(local.offset));
        }
        this.code.append(instructions.eoc());
      };

      ScanningContext.prototype._emitPreConstructor = function(type) {
        if (type.parent != null) {
          this._emitPreConstructor(type.parent);
        }
        if (type.hasConstructor) {
          this.code.append(instructions.preConstructor(type, this.code.frame.currentOffset));
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
