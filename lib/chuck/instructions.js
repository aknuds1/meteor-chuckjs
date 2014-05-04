(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  define("chuck/instructions", ["chuck/ugen", "chuck/logging", "chuck/types"], function(ugen, logging, typesModule) {
    var Instruction, UnaryOpInstruction, callMethod, formatFloat, module, types,
      _this = this;
    module = {};
    types = typesModule.types;
    callMethod = function(vm) {
      var args, func, i, localDepth, retVal, stackDepth, thisObj;
      localDepth = vm.popFromReg();
      logging.debug("Popped local depth from stack: " + localDepth);
      func = vm.popFromReg();
      logging.debug("Popped function from stack");
      stackDepth = func.stackDepth;
      args = [];
      i = 0;
      logging.debug("Popping " + stackDepth + " arguments from stack");
      while (i < stackDepth) {
        logging.debug("Popping argument " + i + " from stack");
        args.unshift(vm.popFromReg());
        ++i;
      }
      thisObj = void 0;
      if (func.isMember) {
        logging.debug("Function is a method, passing 'this' to it");
        thisObj = args.pop();
      }
      retVal = func.apply(thisObj, args);
      if (func.retType !== types["void"]) {
        logging.debug("Pushing return value " + retVal + " to stack");
        return vm.pushToReg(retVal);
      }
    };
    Instruction = (function() {
      function Instruction(name, params, execute) {
        this.execute = __bind(this.execute, this);
        this.instructionName = name;
        _.extend(this, params);
        this._executeCb = execute;
      }

      Instruction.prototype.execute = function(vm) {
        if (!this._executeCb) {
          return;
        }
        return this._executeCb.call(this, vm);
      };

      return Instruction;

    })();
    module.instantiateObject = function(type) {
      return new Instruction("InstantiateObject", {
        type: type
      }, function(vm) {
        var ug;
        logging.debug("Instantiating object of type " + type.name);
        if (type.ugenNumOuts === 1) {
          ug = new ugen.MonoUGen(type);
        } else {
          ug = new ugen.MultiChannelUGen(type);
        }
        vm.addUgen(ug);
        return vm.pushToReg(ug);
      });
    };
    module.allocWord = function(offset, isGlobal) {
      return new Instruction("AllocWord", {
        offset: offset
      }, function(vm) {
        var scopeStr;
        vm.insertIntoMemory(this.offset, 0, isGlobal);
        scopeStr = isGlobal ? "global" : "function";
        logging.debug("Pushing memory stack index " + this.offset + " (scope: " + scopeStr + ") to regular stack");
        return vm.pushToReg(this.offset);
      });
    };
    module.popWord = function() {
      return new Instruction("PopWord", void 0, function(vm) {
        logging.debug("Popping from regular stack");
        return vm.popFromReg();
      });
    };
    module.preConstructor = function(type, stackOffset) {
      return new Instruction("PreConstructor", {
        type: type,
        stackOffset: stackOffset
      }, function(vm) {
        logging.debug("Calling pre-constructor of " + this.type.name);
        vm.pushToReg(vm.peekReg());
        this.type.preConstructor.isMember = true;
        this.type.preConstructor.stackDepth = 1;
        this.type.preConstructor.retType = types["void"];
        vm.pushToReg(this.type.preConstructor);
        vm.pushToReg(this.stackOffset);
        return callMethod(vm);
      });
    };
    module.assignObject = function(isArray, isGlobal) {
      if (isGlobal == null) {
        isGlobal = true;
      }
      return new Instruction("AssignObject", {}, function(vm) {
        var array, index, memStackIndex, obj, scopeStr;
        memStackIndex = vm.popFromReg();
        obj = vm.popFromReg();
        scopeStr = isGlobal ? "global" : "function";
        if (!isArray) {
          logging.debug("" + this.instructionName + ": Assigning object to memory stack index " + memStackIndex + "         (scope: " + scopeStr + "):", obj);
          vm.insertIntoMemory(memStackIndex, obj, isGlobal);
        } else {
          array = memStackIndex[0], index = memStackIndex[1];
          logging.debug("" + this.instructionName + ": Assigning object to array, index " + index + " (scope: " + scopeStr + "):", obj);
          array[index] = obj;
        }
        vm.pushToReg(obj);
      });
    };
    module.plusAssign = function(isGlobal) {
      return new Instruction("PlusAssign", {}, function(vm) {
        var lhs, memStackIndex, result, rhs;
        memStackIndex = vm.popFromReg();
        rhs = vm.popFromReg();
        lhs = vm.getFromMemory(memStackIndex, isGlobal);
        result = lhs + rhs;
        vm.insertIntoMemory(memStackIndex, result, isGlobal);
        vm.pushToReg(result);
      });
    };
    module.minusAssign = function(isGlobal) {
      return new Instruction("MinusAssign", {}, function(vm) {
        var lhs, memStackIndex, result, rhs;
        memStackIndex = vm.popFromReg();
        rhs = vm.popFromReg();
        lhs = vm.getFromMemory(memStackIndex, isGlobal);
        result = lhs - rhs;
        vm.insertIntoMemory(memStackIndex, result, isGlobal);
        vm.pushToReg(result);
      });
    };
    module.allocateArray = function(type) {
      return new Instruction("AllocateArray", {}, function(vm) {
        var array, i, sz, _i;
        sz = vm.popFromReg();
        logging.debug("" + this.instructionName + ": Allocating array of type " + type.name + " and of size " + sz);
        array = new Array(sz);
        for (i = _i = 0; 0 <= sz ? _i < sz : _i > sz; i = 0 <= sz ? ++_i : --_i) {
          array[i] = 0;
        }
        vm.pushToReg(array);
        if (typesModule.isObj(type.arrayType)) {
          logging.debug("" + this.instructionName + ": Pushing index to stack");
          vm.pushToReg(0);
        }
      });
    };
    module.dac = function() {
      return new Instruction("Dac", {}, function(vm) {
        vm.pushDac();
      });
    };
    module.releaseObject2 = function(offset, isGlobal) {
      return new Instruction("ReleaseObject2", {
        offset: offset
      }, function(vm) {
        vm.removeFromMemory(offset, isGlobal);
      });
    };
    module.eoc = function() {
      return new Instruction("Eoc");
    };
    module.uGenLink = function() {
      return new Instruction("UGenLink", {}, function(vm) {
        var dest, src;
        dest = vm.popFromReg();
        src = vm.popFromReg();
        logging.debug("UGenLink: Linking node of type " + src.type.name + " to node of type " + dest.type.name);
        dest.add(src);
        vm.pushToReg(dest);
      });
    };
    module.uGenUnlink = function() {
      return new Instruction("UGenUnlink", {}, function(vm) {
        var dest, src;
        dest = vm.popFromReg();
        src = vm.popFromReg();
        logging.debug("" + this.instructionName + ": Unlinking node of type " + src.type.name + " from node of type " + dest.type.name);
        dest.remove(src);
        vm.pushToReg(dest);
      });
    };
    module.regPushImm = function(val) {
      return new Instruction("RegPushImm", {
        val: val
      }, function(vm) {
        logging.debug("RegPushImm: Pushing " + val + " to stack");
        vm.pushToReg(val);
      });
    };
    module.funcCallMember = function() {
      return new Instruction("FuncCallMember", {}, function(vm) {
        var func, localDepth;
        localDepth = vm.popFromReg();
        func = vm.popFromReg();
        vm.pushToReg(func);
        vm.pushToReg(localDepth);
        logging.debug("Calling instance method '" + func.name + "'");
        return callMethod(vm);
      });
    };
    module.funcCallStatic = function() {
      return new Instruction("FuncCallStatic", {}, function(vm) {
        var func, localDepth, stackDepth;
        localDepth = vm.popFromReg();
        logging.debug("Popped local depth from stack: " + localDepth);
        func = vm.popFromReg();
        stackDepth = func.stackDepth;
        logging.debug("Calling static method '" + func.name + "'");
        vm.pushToReg(func);
        vm.pushToReg(localDepth);
        return callMethod(vm);
      });
    };
    module.funcCall = function() {
      return new Instruction("FuncCall", {}, function(vm) {
        var arg, args, func, i, localDepth, obj, stackDepth, _i, _j, _len;
        localDepth = vm.popFromReg();
        func = vm.popFromReg();
        stackDepth = func.stackDepth;
        logging.debug("" + this.instructionName + ": Calling function " + func.name + ", with stackDepth " + stackDepth);
        logging.debug("" + this.instructionName + ": Pushing current instructions to memory stack");
        vm.pushToMem(vm.instructions);
        logging.debug("" + this.instructionName + ": Pushing current instruction counter to memory stack");
        vm.pushToMem(vm._pc + 1);
        vm._nextPc = 0;
        vm.instructions = func.code.instructions;
        vm.enterFunctionScope();
        if (func.needThis) {
          obj = vm.popFromReg();
          vm.pushToMem(obj, false);
          --stackDepth;
        }
        args = [];
        for (i = _i = 0; 0 <= stackDepth ? _i < stackDepth : _i > stackDepth; i = 0 <= stackDepth ? ++_i : --_i) {
          arg = vm.popFromReg();
          args.unshift(arg);
        }
        for (_j = 0, _len = args.length; _j < _len; _j++) {
          arg = args[_j];
          vm.pushToMem(arg, false);
        }
      });
    };
    module.funcReturn = function() {
      return new Instruction("FuncReturn", {}, function(vm) {
        var instructions, pc;
        logging.debug("" + this.instructionName + ": Returning from function");
        vm.exitFunctionScope();
        logging.debug("" + this.instructionName + ": Popping current instructions from memory stack");
        pc = vm.popFromMem(true);
        logging.debug("" + this.instructionName + ": Popping current instruction counter from memory stack");
        instructions = vm.popFromMem(true);
        vm._nextPc = pc;
        vm.instructions = instructions;
      });
    };
    module.regPushMemAddr = function(offset, isGlobal) {
      return new Instruction("RegPushMemAddr", {}, function(vm) {
        var globalStr;
        globalStr = isGlobal ? " global" : "";
        logging.debug("" + this.instructionName + ": Pushing" + globalStr + " memory address (@" + offset + ") to regular stack");
        vm.pushMemAddrToReg(offset, isGlobal);
      });
    };
    module.regPushMem = function(offset, isGlobal) {
      return new Instruction("RegPushMem", {}, function(vm) {
        var globalStr;
        globalStr = isGlobal ? " global" : "";
        logging.debug("" + this.instructionName + ": Pushing" + globalStr + " memory value (@" + offset + ") to regular stack");
        vm.pushToRegFromMem(offset, isGlobal);
      });
    };
    module.regDupLast = function() {
      return new Instruction("RegDupLast", {}, function(vm) {
        var last;
        last = vm.regStack[vm.regStack.length - 1];
        logging.debug("RegDupLast: Duplicating top of stack: " + last);
        vm.regStack.push(last);
      });
    };
    module.dotMemberFunc = function(func) {
      return new Instruction("DotMemberFunc", {}, function(vm) {
        logging.debug("" + this.instructionName + ": Popping instance from stack");
        vm.popFromReg();
        logging.debug("" + this.instructionName + ": Pushing instance method to stack:", func);
        return vm.pushToReg(func);
      });
    };
    module.dotStaticFunc = function(func) {
      return new Instruction("DotStaticFunc", {}, function(vm) {
        logging.debug("DotStaticFunc: Pushing static method to stack:", func);
        vm.pushToReg(func);
      });
    };
    module.timesNumber = function() {
      return new Instruction("TimesNumber", {}, function(vm) {
        var lhs, number, rhs;
        lhs = vm.popFromReg();
        rhs = vm.popFromReg();
        number = lhs * rhs;
        logging.debug("TimesNumber resulted in: " + number);
        vm.pushToReg(number);
      });
    };
    module.divideNumber = function() {
      return new Instruction("DivideNumber", {}, function(vm) {
        var lhs, number, rhs;
        rhs = vm.popFromReg();
        lhs = vm.popFromReg();
        number = lhs / rhs;
        logging.debug("DivideNumber (" + lhs + "/" + rhs + ") resulted in: " + number);
        vm.pushToReg(number);
      });
    };
    module.regPushNow = function() {
      return new Instruction("RegPushNow", {}, function(vm) {
        vm.pushNow();
      });
    };
    module.regPushMe = function() {
      return new Instruction("RegPushMe", {}, function(vm) {
        vm.pushMe();
      });
    };
    module.addNumber = function() {
      return new Instruction("AddNumber", {}, function(vm) {
        var lhs, number, rhs;
        rhs = vm.popFromReg();
        lhs = vm.popFromReg();
        number = lhs + rhs;
        logging.debug("" + this.instructionName + " resulted in: " + number);
        vm.pushToReg(number);
      });
    };
    module.preIncNumber = function(isGlobal) {
      return new Instruction("PreIncnUmber", {}, function(vm) {
        var memStackIndex, val;
        memStackIndex = vm.popFromReg();
        val = vm.getFromMemory(memStackIndex, isGlobal);
        ++val;
        vm.insertIntoMemory(memStackIndex, val, isGlobal);
        vm.pushToReg(val);
      });
    };
    module.postIncNumber = function(isGlobal) {
      return new Instruction("PostIncnUmber", {}, function(vm) {
        var memStackIndex, val;
        memStackIndex = vm.popFromReg();
        val = vm.getFromMemory(memStackIndex, isGlobal);
        vm.pushToReg(val);
        ++val;
        vm.insertIntoMemory(memStackIndex, val, isGlobal);
      });
    };
    module.subtractNumber = function() {
      return new Instruction("SubtractNumber", {}, function(vm) {
        var lhs, number, rhs;
        rhs = vm.popFromReg();
        lhs = vm.popFromReg();
        number = lhs - rhs;
        logging.debug("" + this.instructionName + ": Subtracting " + rhs + " from " + lhs + " resulted in: " + number);
        vm.pushToReg(number);
      });
    };
    module.timesNumber = function() {
      return new Instruction("TimesNumber", {}, function(vm) {
        var lhs, number, rhs;
        rhs = vm.popFromReg();
        lhs = vm.popFromReg();
        number = lhs * rhs;
        logging.debug("" + this.instructionName + ": Multiplying " + lhs + " with " + rhs + " resulted in: " + number);
        vm.pushToReg(number);
      });
    };
    module.ltNumber = function() {
      return new Instruction("LtNumber", {}, function(vm) {
        var lhs, result, rhs;
        rhs = vm.popFromReg();
        lhs = vm.popFromReg();
        result = lhs < rhs;
        logging.debug("" + this.instructionName + ": Pushing " + result + " to regular stack");
        vm.pushToReg(result);
      });
    };
    module.gtNumber = function() {
      return new Instruction("GtNumber", {}, function(vm) {
        var lhs, result, rhs;
        rhs = vm.popFromReg();
        lhs = vm.popFromReg();
        result = lhs > rhs;
        logging.debug("" + this.instructionName + ": Pushing " + result + " to regular stack");
        vm.pushToReg(result);
      });
    };
    module.timeAdvance = function() {
      return new Instruction("TimeAdvance", {}, function(vm) {
        var time;
        time = vm.popFromReg();
        vm.suspendUntil(time);
        vm.pushToReg(time);
      });
    };
    formatFloat = function(value) {
      return value.toFixed(6);
    };
    module.gack = function(types) {
      return new Instruction("Gack", {}, function(vm) {
        var i, str, tp, value, values, _i, _j, _len, _ref;
        if (types.length === 1) {
          module.hack(types[0]).execute(vm);
          return;
        }
        values = [];
        for (i = _i = 0, _ref = types.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
          values.unshift(vm.popFromReg());
        }
        str = "";
        for (i = _j = 0, _len = types.length; _j < _len; i = ++_j) {
          tp = types[i];
          value = values[i];
          if (tp === types.float) {
            str += "" + (formatFloat(value)) + " ";
          } else {
            str += "" + value + " ";
          }
          vm.pushToReg(value);
        }
        console.log(str.slice(0, str.length - 1));
      });
    };
    module.hack = function(type) {
      return new Instruction("Hack", {}, function(vm) {
        var arrStr, obj;
        obj = vm.peekReg();
        logging.debug("Printing object of type " + type.name + ":", obj);
        if (_.isArray(obj)) {
          arrStr = _.str.join(",", obj);
          console.log("[" + arrStr + "] :(" + type.name + "[])");
        } else if (type === types.String) {
          console.log("\"" + obj + "\" : (" + type.name + ")");
        } else if (type === types.float || type === types.dur) {
          console.log("" + (formatFloat(obj)) + " :(" + type.name + ")");
        } else if (type === types.int) {
          console.log("" + obj + " :(" + type.name + ")");
        } else {
          console.log("" + obj + " : (" + type.name + ")");
        }
      });
    };
    module.branchEq = function(jmp) {
      return new Instruction("BranchEq", {
        jmp: jmp
      }, function(vm) {
        var lhs, result, rhs;
        rhs = vm.popFromReg();
        lhs = vm.popFromReg();
        result = lhs === rhs;
        logging.debug("Comparing " + lhs + " to " + rhs + ": " + result);
        if (result) {
          logging.debug("Jumping to instruction number " + this.jmp);
          vm.jumpTo(this.jmp);
        } else {
          logging.debug("Not jumping");
        }
      });
    };
    module.goto = function(jmp) {
      return new Instruction("Goto", {
        jmp: jmp
      }, function(vm) {
        logging.debug("Jumping to instruction number " + this.jmp);
        vm.jumpTo(this.jmp);
      });
    };
    module.arrayAccess = function(type, emitAddr) {
      return new Instruction("ArrayAccess", {}, function(vm) {
        var array, idx, val, _ref;
        logging.debug("" + this.instructionName + ": Accessing array of type " + type.name);
        _ref = [vm.popFromReg(), vm.popFromReg()], idx = _ref[0], array = _ref[1];
        if (!emitAddr) {
          val = array[idx];
          logging.debug("Pushing array[" + idx + "] (" + val + ") to regular stack");
          vm.pushToReg(val);
        } else {
          logging.debug("Pushing array (" + array + ") and index (" + idx + ") to regular stack");
          vm.pushToReg([array, idx]);
        }
      });
    };
    module.memSetImm = function(offset, value, isGlobal) {
      return new Instruction("MemSetImm", {}, function(vm) {
        var scopeStr;
        scopeStr = isGlobal ? "global" : "function";
        logging.debug("" + this.instructionName + ": Setting memory at offset " + offset + " (scope: " + scopeStr + ") to:", value);
        return vm.insertIntoMemory(offset, value, isGlobal);
      });
    };
    UnaryOpInstruction = (function(_super) {
      __extends(UnaryOpInstruction, _super);

      function UnaryOpInstruction(name, params, execute) {
        this.set = __bind(this.set, this);
        UnaryOpInstruction.__super__.constructor.call(this, name, params, execute);
        this._val = 0;
      }

      UnaryOpInstruction.prototype.set = function(val) {
        return this._val = val;
      };

      return UnaryOpInstruction;

    })(Instruction);
    module.preCtorArrayTop = function(type) {
      return new UnaryOpInstruction("PreCtorArrayTop", {}, function(vm) {
        var array, index;
        index = vm.peekReg();
        array = vm.peekReg(1);
        if (index >= array.length) {
          logging.debug("" + this.instructionName + ": Finished instantiating elements");
          return vm.jumpTo(this._val);
        } else {
          logging.debug("" + this.instructionName + ": Instantiating element " + index + " of type " + type.name);
          return module.instantiateObject(type).execute(vm);
        }
      });
    };
    module.preCtorArrayBottom = function() {
      return new UnaryOpInstruction("PreCtorArrayBottom", {}, function(vm) {
        var array, index, obj;
        logging.debug("" + this.instructionName + ": Popping object and index from stack");
        obj = vm.popFromReg();
        index = vm.popFromReg();
        logging.debug("" + this.instructionName + ": Peeking array from stack");
        array = vm.peekReg();
        logging.debug("" + this.instructionName + ": Assigning to index " + index + " of array:", obj);
        array[index] = obj;
        logging.debug("" + this.instructionName + ": Pushing incremented index to stack");
        vm.pushToReg(index + 1);
        logging.debug("" + this.instructionName + ": Jumping to instruction " + this._val);
        return vm.jumpTo(this._val);
      });
    };
    module.preCtorArrayPost = function() {
      return new Instruction("PreCtorArrayPost", {}, function(vm) {
        logging.debug("" + this.instructionName + ": Cleaning up, popping index from stack");
        return vm.popFromReg();
      });
    };
    module.arrayInit = function(type, count) {
      return new Instruction("ArrayInit", {}, function(vm) {
        var i, values, _i;
        logging.debug("" + this.instructionName + ": Popping " + count + " elements from stack");
        values = [];
        for (i = _i = 0; 0 <= count ? _i < count : _i > count; i = 0 <= count ? ++_i : --_i) {
          values.unshift(vm.popFromReg());
        }
        logging.debug("" + this.instructionName + ": Pushing instantiated array to stack", values);
        return vm.pushToReg(values);
      });
    };
    module.negateNumber = function() {
      return new Instruction("NegateNumber", {}, function(vm) {
        var number;
        logging.debug("" + this.instructionName + ": Popping number from stack");
        number = vm.popFromReg();
        logging.debug("" + this.instructionName + ": Pushing negated number to stack");
        return vm.pushToReg(-number);
      });
    };
    return module;
  });

}).call(this);
