(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty;

  define("chuck/scanner", ["chuck/nodes", "chuck/types", "chuck/instructions", "chuck/namespace", "chuck/logging", "chuck/libs/math", "chuck/libs/std", "chuck/libs/stk", "chuck/libs/ugens"], function(nodes, types, instructions, namespaceModule, logging, mathLib, stdLib, stkLib, ugensLib) {
    var ChuckCode, ChuckFrame, ChuckLocal, Instruction, Scanner, ScanningContext, module;
    module = {};
    Instruction = instructions.Instruction;
    ChuckLocal = (function() {
      function ChuckLocal(size, ri, name, isContextGlobal) {
        this.size = size;
        this.ri = ri;
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
        this.instructions = [];
        this.frame = new ChuckFrame();
        this._ri = 0;
        this.pushScope();
      }

      ChuckCode.prototype.allocRegister = function(value) {
        var ri;
        ri = ++this._ri;
        if (value != null) {
          value.ri = ri;
        }
        return ri;
      };

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
        var local, ri, scopeStr;
        ri = this.allocRegister();
        local = new ChuckLocal(type.size, ri, value.name, isGlobal);
        scopeStr = isGlobal ? "global" : "function";
        logging.debug("Allocating local " + value.name + " of type " + type.name + " in register " + local.ri + " (scope: " + scopeStr + ")");
        this.frame.currentOffset += 1;
        this.frame.stack.push(local);
        value.ri = local.ri;
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
        this.emitRegPushMe = __bind(this.emitRegPushMe, this);
        this.emitRegPushMem = __bind(this.emitRegPushMem, this);
        this.emitRegPushMemAddr = __bind(this.emitRegPushMemAddr, this);
        this.emitMinusAssign = __bind(this.emitMinusAssign, this);
        this.emitPlusAssign = __bind(this.emitPlusAssign, this);
        this.exitCodeScope = __bind(this.exitCodeScope, this);
        this.enterCodeScope = __bind(this.enterCodeScope, this);
        this.exitScope = __bind(this.exitScope, this);
        this.enterScope = __bind(this.enterScope, this);
        this.getNextIndex = __bind(this.getNextIndex, this);
        this.instantiateObject = __bind(this.instantiateObject, this);
        this.pushToContStack = __bind(this.pushToContStack, this);
        this.pushToBreakStack = __bind(this.pushToBreakStack, this);
        this.findValue = __bind(this.findValue, this);
        this.findType = __bind(this.findType, this);
        this.popCode = __bind(this.popCode, this);
        this.pushCode = __bind(this.pushCode, this);
        var k, lib, type, typeType, value, _i, _len, _ref, _ref1;
        this.code = new ChuckCode();
        this._globalNamespace = new namespaceModule.Namespace("global");
        _ref = [types, mathLib, stdLib, stkLib, ugensLib];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          lib = _ref[_i];
          _ref1 = lib.types;
          for (k in _ref1) {
            if (!__hasProp.call(_ref1, k)) continue;
            type = _ref1[k];
            this._globalNamespace.addType(type);
            typeType = _.extend({}, types.Class);
            typeType.actualType = type;
            value = this._globalNamespace.addVariable(type.name, typeType, type);
            this.code.allocRegister(value);
          }
        }
        value = this._globalNamespace.addVariable("dac", types.types.Dac);
        this.code.allocRegister(value);
        value = this._globalNamespace.addVariable("blackhole", types.types.Bunghole);
        this.code.allocRegister(value);
        value = this._globalNamespace.addVariable("now", types.types.Time);
        this.code.allocRegister(value);
        value = this._globalNamespace.addVariable("me", types.types.shred);
        this.code.allocRegister(value);
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

      ScanningContext.prototype.isInFunction = function() {
        return this._functionLevel > 0;
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

      ScanningContext.prototype.instantiateObject = function(type, ri) {
        logging.debug("Emitting instantiation of object of type " + type.name + " along with preconstructor");
        this.code.append(instructions.instantiateObject(type, ri));
        this._emitPreConstructor(type, ri);
      };

      /* Allocate new register.*/


      ScanningContext.prototype.allocRegister = function() {
        return this.code.allocRegister();
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
          this.code.append(new Instruction("InitValue", {
            r1: local.ri
          }));
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
        var addConstructors, array, elemType, isObj, local, typesWithCtors, value;
        value = varDecl.value, array = varDecl.array;
        local = this.allocateLocal(type, value);
        if (array != null) {
          logging.debug("Emitting array indices");
          array.scanPass5(this);
          logging.debug("Emitting AllocateArray");
          this.code.append(instructions.allocateArray(type, array.ri, local.ri));
          elemType = type.arrayType;
          typesWithCtors = [];
          addConstructors = function(type) {
            if (type.parent != null) {
              addConstructors(type.parent);
            }
            if (type.hasConstructor) {
              return typesWithCtors.push(type);
            }
          };
          if (types.isObj(elemType)) {
            logging.debug("Emitting PreCtorArray");
            addConstructors(elemType);
            this.code.append(instructions.preCtorArray(elemType, array.ri, local.ri, typesWithCtors));
          }
        }
        isObj = types.isObj(type) || (array != null);
        if (isObj && (array == null) && !type.isRef) {
          this.instantiateObject(type, local.ri);
        }
        return local.ri;
      };

      ScanningContext.prototype.emitPlusAssign = function(r1, r2, r3) {
        this.code.append(instructions.plusAssign(r1, r2, r3));
      };

      ScanningContext.prototype.emitMinusAssign = function(r1, r2, r3) {
        this.code.append(instructions.minusAssign(r1, r2, r3));
      };

      ScanningContext.prototype.emitUGenLink = function(r1, r2) {
        this.code.append(instructions.uGenLink(r1, r2));
      };

      ScanningContext.prototype.emitUGenUnlink = function(r1, r2) {
        this.code.append(instructions.uGenUnlink(r1, r2));
      };

      ScanningContext.prototype.emitLoadConst = function(value) {
        var r1;
        r1 = this.allocRegister();
        this.code.append(new Instruction("LoadConst", {
          val: value,
          r1: r1
        }));
        return r1;
      };

      ScanningContext.prototype.emitLoadLocal = function(r1) {
        var r2;
        r2 = this.allocRegister();
        this.code.append(new Instruction("LoadLocal", {
          r1: r1,
          r2: r2
        }));
        return r2;
      };

      ScanningContext.prototype.emitFuncCallMember = function(r1, argRegisters, r3) {
        this.code.append(new Instruction("FuncCallMember", {
          r1: r1,
          argRegisters: argRegisters,
          r3: r3
        }));
      };

      ScanningContext.prototype.emitFuncCallStatic = function(r1, argRegisters, r3) {
        this.code.append(new Instruction("FuncCallStatic", {
          r1: r1,
          argRegisters: argRegisters,
          r3: r3
        }));
      };

      ScanningContext.prototype.emitFuncCall = function(r1, argRegisters, r3) {
        return this.code.append(instructions.funcCall(r1, argRegisters, r3));
      };

      ScanningContext.prototype.emitRegPushMemAddr = function(offset, isGlobal) {
        this.code.append(instructions.regPushMemAddr(offset, isGlobal));
      };

      ScanningContext.prototype.emitRegPushMem = function(offset, isGlobal) {
        this.code.append(instructions.regPushMem(offset, isGlobal));
      };

      ScanningContext.prototype.emitDotStaticFunc = function(func) {
        this.code.append(instructions.dotStaticFunc(func));
      };

      ScanningContext.prototype.emitDotMemberFunc = function(func, r1) {
        var r2;
        r2 = this.allocRegister();
        this.code.append(new Instruction("DotMemberFunc", {
          func: func,
          r1: r1,
          r2: r2
        }));
        return r2;
      };

      ScanningContext.prototype.emitTimesNumber = function(r1, r2, r3) {
        this.code.append(new Instruction("TimesNumber", {
          r1: r1,
          r2: r2,
          r3: r3
        }));
      };

      ScanningContext.prototype.emitDivideNumber = function(r1, r2, r3) {
        this.code.append(instructions.divideNumber(r1, r2, r3));
      };

      ScanningContext.prototype.emitRegPushMe = function() {
        this.code.append(instructions.regPushMe());
      };

      ScanningContext.prototype.emitAddNumber = function(r1, r2, r3) {
        this.code.append(new Instruction("AddNumber", {
          r1: r1,
          r2: r2,
          r3: r3
        }));
      };

      ScanningContext.prototype.emitPreIncNumber = function(r1, r2) {
        return this.code.append(instructions.preIncNumber(r1, r2));
      };

      ScanningContext.prototype.emitPostIncNumber = function(r1, r2) {
        return this.code.append(instructions.postIncNumber(r1, r2));
      };

      ScanningContext.prototype.emitSubtractNumber = function(r1, r2, r3) {
        this.code.append(instructions.subtractNumber(r1, r2, r3));
      };

      ScanningContext.prototype.emitTimesNumber = function(r1, r2, r3) {
        return this.code.append(new Instruction("TimesNumber", {
          r1: r1,
          r2: r2,
          r3: r3
        }));
      };

      ScanningContext.prototype.emitLtNumber = function(r1, r2, r3) {
        this.code.append(new Instruction("LtNumber", {
          r1: r1,
          r2: r2,
          r3: r3
        }));
      };

      ScanningContext.prototype.emitGtNumber = function(r1, r2, r3) {
        this.code.append(new Instruction("GtNumber", {
          r1: r1,
          r2: r2,
          r3: r3
        }));
      };

      ScanningContext.prototype.emitLeNumber = function(r1, r2, r3) {
        this.code.append(new Instruction("LeNumber", {
          r1: r1,
          r2: r2,
          r3: r3
        }));
      };

      ScanningContext.prototype.emitGeNumber = function(r1, r2, r3) {
        this.code.append(new Instruction("GeNumber", {
          r1: r1,
          r2: r2,
          r3: r3
        }));
      };

      ScanningContext.prototype.emitTimeAdvance = function(r1) {
        logging.debug("Emitting TimeAdvance of register " + r1);
        this.code.append(new Instruction("TimeAdvance", {
          r1: r1
        }));
      };

      ScanningContext.prototype.emitOpAtChuck = function(r1, r2, isArray) {
        if (isArray == null) {
          isArray = false;
        }
        logging.debug("Emitting AssignObject of register " + r1 + " to " + r2 + " (isArray: " + isArray + ")");
        this.code.append(instructions.assignObject(isArray, this._isGlobal, r1, r2));
      };

      ScanningContext.prototype.emitGack = function(types, registers) {
        this.code.append(instructions.gack(types, registers));
      };

      ScanningContext.prototype.emitBranchEq = function(r1, r2, jmp) {
        logging.debug("Emitting BranchEq of registers " + r1 + " and " + r2);
        return this.code.append(new Instruction("BranchEq", {
          r1: r1,
          r2: r2,
          jmp: jmp
        }));
      };

      ScanningContext.prototype.emitBranchIfFalse = function(r1) {
        logging.debug("Emitting BranchIfFalse of register " + r1);
        return this.code.append(new Instruction("BranchIfFalse", {
          r1: r1
        }));
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

      ScanningContext.prototype.emitArrayAccess = function(type, r1, r2, r3, emitAddr) {
        return this.code.append(instructions.arrayAccess(type, r1, r2, r3, emitAddr));
      };

      ScanningContext.prototype.emitArrayInit = function(type, registers, ri) {
        return this.code.append(instructions.arrayInit(type, registers, ri));
      };

      ScanningContext.prototype.emitStoreConst = function(r1, value) {
        return this.code.append(new Instruction("StoreConst", {
          r1: r1,
          value: value
        }));
      };

      ScanningContext.prototype.emitFuncReturn = function() {
        return this.code.append(instructions.funcReturn());
      };

      ScanningContext.prototype.emitNegateNumber = function(r1, r2) {
        return this.code.append(instructions.negateNumber(r1, r2));
      };

      ScanningContext.prototype.emitLoadGlobal = function(r1, r2) {
        return this.code.append(new Instruction("LoadGlobal", {
          r1: r1,
          r2: r2
        }));
      };

      ScanningContext.prototype.evaluateBreaks = function() {
        var instr;
        while (this._breakStack.length) {
          instr = this._breakStack.pop();
          instr.jmp = this._nextIndex();
        }
      };

      ScanningContext.prototype.finishScanning = function() {
        this.code.finish();
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

      ScanningContext.prototype._emitPreConstructor = function(type, ri) {
        if (type.parent != null) {
          this._emitPreConstructor(type.parent, ri);
        }
        if (type.hasConstructor) {
          this.code.append(instructions.preConstructor(type, ri));
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
        this._ri = 1;
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
