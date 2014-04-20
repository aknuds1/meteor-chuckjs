(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  define("chuck/instructions", ["chuck/ugen", "chuck/logging", "chuck/types"], function(ugen, logging, typesModule) {
    var Instruction, UnaryOpInstruction, callMethod, formatFloat, module, types;
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
      while (i < stackDepth) {
        args.unshift(vm.popFromReg());
        logging.debug("Popping argument " + i + " from stack: " + args[0]);
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
        ug = new ugen.UGen(type);
        vm.addUgen(ug);
        return vm.pushToReg(ug);
      });
    };
    module.allocWord = function(offset) {
      return new Instruction("AllocWord", {
        offset: offset
      }, function(vm) {
        vm.insertIntoMemory(this.offset, 0);
        logging.debug("Pushing memory stack index " + this.offset + " to regular stack");
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
    module.assignObject = function(isArray) {
      return new Instruction("AssignObject", {}, function(vm) {
        var array, index, memStackIndex, obj;
        memStackIndex = vm.popFromReg();
        obj = vm.popFromReg();
        if (!isArray) {
          logging.debug("" + this.instructionName + ": Assigning object (" + obj + ") to memory stack index " + memStackIndex);
          vm.insertIntoMemory(memStackIndex, obj);
        } else {
          array = memStackIndex[0], index = memStackIndex[1];
          logging.debug("" + this.instructionName + ": Assigning object (" + obj + ") to array, index " + index);
          array[index] = obj;
        }
        vm.pushToReg(obj);
      });
    };
    module.minusAssign = function() {
      return new Instruction("MinusAssign", {}, function(vm) {
        var lhs, memStackIndex, result, rhs;
        memStackIndex = vm.popFromReg();
        rhs = vm.popFromReg();
        lhs = vm.getFromMemory(memStackIndex);
        result = lhs - rhs;
        vm.insertIntoMemory(memStackIndex, result);
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
        if (typesModule.isObj(type)) {
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
    module.releaseObject2 = function(offset) {
      return new Instruction("ReleaseObject2", {
        offset: offset
      }, function(vm) {
        vm.removeFromMemory(offset);
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
    module.funcToCode = function() {
      return new Instruction("");
    };
    module.regPushMemAddr = function(offset) {
      return new Instruction("RegPushMemAddr", {}, function(vm) {
        vm.pushMemAddrToReg(offset);
      });
    };
    module.regPushMem = function(offset) {
      return new Instruction("RegPushMem", {}, function(vm) {
        vm.pushToRegFromMem(offset);
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
    module.preIncNumber = function() {
      return new Instruction("PreIncnUmber", {}, function(vm) {
        var memStackIndex, val;
        memStackIndex = vm.popFromReg();
        val = vm.getFromMemory(memStackIndex);
        ++val;
        vm.insertIntoMemory(memStackIndex, val);
        vm.pushToReg(val);
      });
    };
    module.postIncNumber = function() {
      return new Instruction("PostIncnUmber", {}, function(vm) {
        var memStackIndex, val;
        memStackIndex = vm.popFromReg();
        val = vm.getFromMemory(memStackIndex);
        vm.pushToReg(val);
        ++val;
        vm.insertIntoMemory(memStackIndex, val);
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
        var obj;
        obj = vm.peekReg();
        logging.debug("Printing object of type " + type.name + ":", obj);
        if (type === types.String) {
          console.log("\"" + obj + "\" : (" + type.name + ")");
        } else if (type === types.float) {
          console.log("" + (formatFloat(obj)) + " :(" + type.name + ")");
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
    return module;
  });

}).call(this);
