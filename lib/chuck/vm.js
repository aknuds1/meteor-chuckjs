(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  define("chuck/vm", ["chuck/logging", "chuck/types", "chuck/audioContextService", "chuck/ugen"], function(logging, types, audioContextService, ugenModule) {
    var Shred, Vm, callBuiltInFunction, compute, executeInstruction, logDebug, module;
    module = {};
    logDebug = function() {};
    callBuiltInFunction = function(vm, func, argRegisters, r3) {
      var args, retVal, thisObj;
      args = argRegisters.map(function(ri) {
        return vm.registers[ri];
      });
      if (func.isMember) {
        logDebug("Function is a method, passing 'this' to it");
        thisObj = args.shift();
      }
      logDebug("Calling function with arguments corresponding to registers " + argRegisters + ":", args);
      retVal = func.apply(thisObj, args);
      if (func.retType !== types["void"]) {
        logDebug("Registering return value:", retVal);
        vm.registers[r3] = retVal;
      }
    };
    executeInstruction = function(vm, instr) {
      var func, lhs, number, result, rhs, time, value;
      switch (instr.instructionName) {
        case "LoadConst":
          logDebug("LoadConst: Loading constant in register " + instr.r1 + ":", instr.val);
          vm.registers[instr.r1] = instr.val;
          break;
        case "LoadLocal":
          value = vm.registers[instr.r1];
          logDebug("LoadLocal: Loading local from register " + instr.r1 + " to register " + instr.r2 + ":", value);
          vm.registers[instr.r2] = value;
          break;
        case "LoadGlobal":
          value = vm.globalRegisters[instr.r1];
          logDebug("" + instr.instructionName + ": Loading global from register " + instr.r1 + " to register " + instr.r2 + ":", value);
          vm.registers[instr.r2] = value;
          break;
        case "FuncCallMember":
          func = vm.registers[instr.r1];
          logDebug("Calling instance method '" + func.name + "'");
          callBuiltInFunction(vm, func, instr.argRegisters, instr.r3);
          break;
        case "BranchEq":
          lhs = vm.registers[instr.r1];
          rhs = vm.registers[instr.r2];
          result = lhs === rhs;
          logDebug("Comparing " + lhs + " to " + rhs + ": " + result);
          if (result) {
            logDebug("Jumping to instruction number " + instr.jmp);
            vm.jumpTo(instr.jmp);
          } else {
            logDebug("Not jumping");
          }
          break;
        case "DotMemberFunc":
          logDebug("" + instr.instructionName + ": Putting instance method in register " + instr.r2 + ":", instr.func);
          vm.registers[instr.r2] = instr.func;
          break;
        case "TimesNumber":
          lhs = vm.registers[instr.r1];
          rhs = vm.registers[instr.r2];
          number = lhs * rhs;
          logDebug("TimesNumber resulted in: " + number);
          vm.registers[instr.r3] = number;
          break;
        case "TimeAdvance":
          time = vm.registers[instr.r1];
          vm.suspendUntil(vm.globalRegisters[vm._nowRi] + time);
          break;
        case "AddNumber":
          lhs = vm.registers[instr.r1];
          rhs = vm.registers[instr.r2];
          number = lhs + rhs;
          logDebug("" + instr.instructionName + ": (" + lhs + " + " + rhs + ") resulted in: " + number);
          vm.registers[instr.r3] = number;
          break;
        case "LtNumber":
          lhs = vm.registers[instr.r1];
          rhs = vm.registers[instr.r2];
          result = lhs < rhs;
          logDebug("" + instr.instructionName + ": (" + lhs + " < " + rhs + ") resulted in: " + result);
          vm.registers[instr.r3] = result;
          break;
        case "GtNumber":
          lhs = vm.registers[instr.r1];
          rhs = vm.registers[instr.r2];
          result = lhs > rhs;
          logDebug("" + instr.instructionName + ": (" + lhs + " > " + rhs + ") resulted in: " + result);
          vm.registers[instr.r3] = result;
          break;
        case "FuncCallStatic":
          func = vm.registers[instr.r1];
          logDebug("Calling static method '" + func.name + "'");
          callBuiltInFunction(vm, func, instr.argRegisters, instr.r3);
          break;
        case "InitValue":
          logDebug("" + instr.instructionName + ": Initializing value at register " + instr.r1);
          vm.registers[instr.r1] = 0;
          break;
        case "StoreConst":
          logDebug("" + instr.instructionName + ": Storing constant value in register " + instr.r1 + ":", instr.value);
          vm.registers[instr.r1] = instr.value;
          break;
        default:
          return instr.execute(vm);
      }
    };
    compute = function(self) {
      var instr, sampleRate;
      if (self._pc === 0) {
        logDebug("VM executing");
      } else {
        logDebug("Resuming VM execution");
      }
      while (self._pc < self.instructions.length && self._isRunning()) {
        instr = self.instructions[self._pc];
        logDebug("Executing instruction no. " + self._pc + ": " + instr.instructionName);
        executeInstruction(self, instr);
        self._pc = self._nextPc;
        ++self._nextPc;
      }
      if ((self._wakeTime != null) && !self._shouldStop) {
        sampleRate = audioContextService.getSampleRate();
        logDebug("Halting VM execution for " + ((self._wakeTime - self.globalRegisters[self._nowRi]) / sampleRate) + " second(s)");
        return true;
      } else {
        logDebug("VM execution has ended after " + self._nowSystem + " samples:", self._shouldStop);
        self._shouldStop = true;
        return false;
      }
    };
    Shred = (function() {
      function Shred(args) {
        this.args = args || [];
      }

      return Shred;

    })();
    module.Vm = Vm = (function() {
      function Vm(args) {
        this.stop = __bind(this.stop, this);
        this.regStack = [];
        this.memStack = [];
        this._funcMemStacks = [];
        this._dac = new ugenModule.Dac();
        this._bunghole = new ugenModule.Bunghole();
        this.registers = this.globalRegisters = [];
        this.globalRegisters[30] = this._dac;
        this.globalRegisters[31] = this._bunghole;
        this._registersStack = [this.globalRegisters];
        this.instructionsStack = [];
        this.instructions = null;
        this.isExecuting = false;
        this._ugens = [];
        this._wakeTime = void 0;
        this._pc = 0;
        this._nextPc = 1;
        this._shouldStop = false;
        this._nowRi = 32;
        this.globalRegisters[this._nowRi] = 0;
        this._me = this.globalRegisters[33] = new Shred(args);
        this._nowSystem = 0;
        this._gain = 1;
      }

      Vm.prototype.execute = function(byteCode) {
        var deferred,
          _this = this;
        this._pc = 0;
        this.isExecuting = true;
        this.instructions = byteCode;
        this.instructionsStack = [];
        deferred = Q.defer();
        setTimeout(function() {
          if (!compute(_this)) {
            logDebug("Ending VM execution");
            _this._terminateProcessing();
            deferred.resolve();
            return;
          }
          logDebug("Starting audio processing");
          _this._scriptProcessor = audioContextService.createScriptProcessor();
          return _this._scriptProcessor.onaudioprocess = function(event) {
            var error;
            try {
              _this._processAudio(event, deferred);
            } catch (_error) {
              error = _error;
              _this._terminateProcessing();
              deferred.reject("Caught exception in audio processing callback after " + _this._nowSystem + " samples: " + error);
            }
          };
        }, 0);
        return deferred.promise;
      };

      Vm.prototype.stop = function() {
        logDebug("Stopping VM");
        this._shouldStop = true;
      };

      Vm.prototype.addUgen = function(ugen) {
        this._ugens.push(ugen);
      };

      Vm.prototype.pushToReg = function(value) {
        if (value == null) {
          throw new Error('pushToReg: value is undefined');
        }
        this.regStack.push(value);
      };

      Vm.prototype.pushMemAddrToReg = function(offset, isGlobal) {
        var scopeStr, value;
        value = this._getMemStack(isGlobal)[offset];
        scopeStr = isGlobal ? "global" : "function";
        logDebug("Pushing memory stack address " + offset + " (scope: " + scopeStr + ") to regular stack:", value);
        return this.regStack.push(offset);
      };

      Vm.prototype.insertIntoMemory = function(index, value, isGlobal) {
        var scopeStr;
        scopeStr = isGlobal ? "global" : "function";
        logDebug("Inserting value " + value + " (" + (typeof value) + ") into memory stack at index " + index + " (scope: " + scopeStr + ")");
        this._getMemStack(isGlobal)[index] = value;
      };

      Vm.prototype.removeFromMemory = function(index, isGlobal) {
        logDebug("Removing element " + index + " of memory stack");
        this._getMemStack(isGlobal).splice(index, 1);
      };

      Vm.prototype.getFromMemory = function(index, isGlobal) {
        var memStack, scopeStr, val;
        memStack = this._getMemStack(isGlobal);
        val = memStack[index];
        scopeStr = isGlobal ? "global" : "function";
        logDebug("Getting value from memory stack at index " + index + " (scope: " + scopeStr + "):", val);
        return val;
      };

      Vm.prototype.suspendUntil = function(time) {
        logDebug("Suspending VM execution until " + time + " (now: " + this.globalRegisters[this._nowRi] + ")");
        this._wakeTime = time;
      };

      Vm.prototype.jumpTo = function(jmp) {
        this._nextPc = jmp;
      };

      Vm.prototype.enterFunctionScope = function() {
        logDebug("Entering new function scope");
        this._funcMemStacks.push([]);
        this.registers = [];
        return this._registersStack.push(this.registers);
      };

      Vm.prototype.exitFunctionScope = function() {
        logDebug("Exiting current function scope");
        this._funcMemStacks.pop();
        this._registersStack.pop();
        return this.registers = this._registersStack[this._registersStack.length - 1];
      };

      Vm.prototype._terminateProcessing = function() {
        logDebug("Terminating processing");
        this._dac.stop();
        if (this._scriptProcessor != null) {
          this._scriptProcessor.disconnect(0);
          this._scriptProcessor = void 0;
        }
        return this.isExecuting = false;
      };

      /** Get the memory stack for the requested scope (global/function)
      */


      Vm.prototype._getMemStack = function(isGlobal) {
        if (isGlobal == null) {
          throw new Error('isGlobal must be specified');
        }
        if (isGlobal) {
          return this.memStack;
        } else {
          return this._funcMemStacks[this._funcMemStacks.length - 1];
        }
      };

      Vm.prototype._isRunning = function() {
        return (this._wakeTime == null) && !this._shouldStop;
      };

      Vm.prototype._processAudio = function(event, deferred) {
        var frame, i, now, samplesLeft, samplesRight, _i, _j, _ref, _ref1;
        samplesLeft = event.outputBuffer.getChannelData(0);
        samplesRight = event.outputBuffer.getChannelData(1);
        if (this._shouldStop) {
          logDebug("Audio callback finishing execution after processing " + this._nowSystem + " samples");
          for (i = _i = 0, _ref = event.outputBuffer.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
            samplesLeft[i] = 0;
            samplesRight[i] = 0;
          }
          this._terminateProcessing();
          deferred.resolve();
          return;
        }
        logDebug("Audio callback processing " + event.outputBuffer.length + " samples");
        for (i = _j = 0, _ref1 = event.outputBuffer.length; 0 <= _ref1 ? _j < _ref1 : _j > _ref1; i = 0 <= _ref1 ? ++_j : --_j) {
          if (this._wakeTime <= (this._nowSystem + 0.5)) {
            now = this.globalRegisters[this._nowRi] = this._wakeTime;
            this._wakeTime = void 0;
            logDebug("Letting VM compute sample, now: " + now);
            compute(this);
          }
          ++this._nowSystem;
          frame = [0, 0];
          if (!this._shouldStop) {
            this._dac.tick(this._nowSystem, frame);
            this._bunghole.tick(this._nowSystem);
          }
          samplesLeft[i] = frame[0] * this._gain;
          samplesRight[i] = frame[1] * this._gain;
        }
        if (this._shouldStop) {
          logDebug("Audio callback: In the process of stopping, flushing buffers");
        }
        logDebug("Audio callback finished processing, currently at " + this._nowSystem + " samples in total");
      };

      return Vm;

    })();
    return module;
  });

}).call(this);
