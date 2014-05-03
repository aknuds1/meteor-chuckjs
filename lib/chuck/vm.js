(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  define("chuck/vm", ["chuck/logging", "chuck/ugen", "chuck/types", "chuck/audioContextService"], function(logging, ugen, types, audioContextService) {
    var Shred, Vm, module;
    module = {};
    Shred = (function() {
      function Shred(args) {
        this.args = args || [];
      }

      return Shred;

    })();
    module.Vm = Vm = (function() {
      function Vm(args) {
        this._processAudio = __bind(this._processAudio, this);
        this._isRunning = __bind(this._isRunning, this);
        this._getMemStack = __bind(this._getMemStack, this);
        this._terminateProcessing = __bind(this._terminateProcessing, this);
        this.exitFunctionScope = __bind(this.exitFunctionScope, this);
        this.enterFunctionScope = __bind(this.enterFunctionScope, this);
        this.jumpTo = __bind(this.jumpTo, this);
        this.suspendUntil = __bind(this.suspendUntil, this);
        this.pushMe = __bind(this.pushMe, this);
        this.pushNow = __bind(this.pushNow, this);
        this.pushDac = __bind(this.pushDac, this);
        this.popFromMem = __bind(this.popFromMem, this);
        this.pushToMem = __bind(this.pushToMem, this);
        this.getFromMemory = __bind(this.getFromMemory, this);
        this.removeFromMemory = __bind(this.removeFromMemory, this);
        this.insertIntoMemory = __bind(this.insertIntoMemory, this);
        this.peekReg = __bind(this.peekReg, this);
        this.popFromReg = __bind(this.popFromReg, this);
        this.pushToRegFromMem = __bind(this.pushToRegFromMem, this);
        this.pushMemAddrToReg = __bind(this.pushMemAddrToReg, this);
        this.pushToReg = __bind(this.pushToReg, this);
        this.addUgen = __bind(this.addUgen, this);
        this._compute = __bind(this._compute, this);
        this.stop = __bind(this.stop, this);
        this.execute = __bind(this.execute, this);
        this.regStack = [];
        this.memStack = [];
        this._funcMemStacks = [];
        this.isExecuting = false;
        this._ugens = [];
        this._dac = new ugen.Dac();
        this._wakeTime = void 0;
        this._pc = 0;
        this._nextPc = 1;
        this._shouldStop = false;
        this._now = 0;
        this._me = new Shred(args);
        this._nowSystem = 0;
        this._gain = 1;
      }

      Vm.prototype.execute = function(byteCode) {
        var deferred,
          _this = this;
        this._pc = 0;
        this.isExecuting = true;
        this.instructions = byteCode;
        deferred = Q.defer();
        setTimeout(function() {
          if (!_this._compute(deferred)) {
            logging.debug("Ending VM execution");
            _this._terminateProcessing();
            deferred.resolve();
            return;
          }
          logging.debug("Starting audio processing");
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
        logging.debug("Stopping VM");
        this._shouldStop = true;
      };

      Vm.prototype._compute = function(deferred) {
        var err, instr, sampleRate;
        try {
          if (this._pc === 0) {
            logging.debug("VM executing");
          } else {
            logging.debug("Resuming VM execution");
          }
          while (this._pc < this.instructions.length && this._isRunning()) {
            instr = this.instructions[this._pc];
            logging.debug("Executing instruction no. " + this._pc + ": " + instr.instructionName);
            instr.execute(this);
            this._pc = this._nextPc;
            ++this._nextPc;
          }
          if ((this._wakeTime != null) && !this._shouldStop) {
            sampleRate = audioContextService.getSampleRate();
            logging.debug("Halting VM execution for " + ((this._wakeTime - this._now) / sampleRate) + " second(s)");
            return true;
          } else {
            logging.debug("VM execution has ended after " + this._nowSystem + " samples:", this._shouldStop);
            this._shouldStop = true;
            return false;
          }
        } catch (_error) {
          err = _error;
          deferred.reject(err);
          throw err;
        }
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
        logging.debug("Pushing memory stack address " + offset + " (scope: " + scopeStr + ") to regular stack:", value);
        return this.regStack.push(offset);
      };

      Vm.prototype.pushToRegFromMem = function(offset, isGlobal) {
        var scopeStr, value;
        value = this._getMemStack(isGlobal)[offset];
        scopeStr = isGlobal ? "global" : "function";
        logging.debug("Pushing memory stack value @" + offset + " (scope: " + scopeStr + ") to regular stack:", value);
        return this.regStack.push(value);
      };

      Vm.prototype.popFromReg = function() {
        var val;
        val = this.regStack.pop();
        if (val == null) {
          throw new Error("Nothing on the stack");
        }
        return val;
      };

      Vm.prototype.peekReg = function(offset) {
        if (offset == null) {
          offset = 0;
        }
        return this.regStack[this.regStack.length - (1 + offset)];
      };

      Vm.prototype.insertIntoMemory = function(index, value, isGlobal) {
        var scopeStr;
        scopeStr = isGlobal ? "global" : "function";
        logging.debug("Inserting value " + value + " (" + (typeof value) + ") into memory stack at index " + index + " (scope: " + scopeStr + ")");
        this._getMemStack(isGlobal)[index] = value;
      };

      Vm.prototype.removeFromMemory = function(index, isGlobal) {
        logging.debug("Removing element " + index + " of memory stack");
        this._getMemStack(isGlobal).splice(index, 1);
      };

      Vm.prototype.getFromMemory = function(index, isGlobal) {
        var memStack, scopeStr, val;
        memStack = this._getMemStack(isGlobal);
        val = memStack[index];
        scopeStr = isGlobal ? "global" : "function";
        logging.debug("Getting value from memory stack at index " + index + " (scope: " + scopeStr + "):", val);
        return val;
      };

      Vm.prototype.pushToMem = function(value, isGlobal) {
        var memStack;
        if (isGlobal == null) {
          isGlobal = true;
        }
        if (value == null) {
          throw new Error('pushToMem: value is undefined');
        }
        memStack = this._getMemStack(isGlobal);
        if (isGlobal) {
          logging.debug("Pushing value to global memory stack:", value);
        } else {
          logging.debug("Pushing value to function memory stack:", value);
        }
        return memStack.push(value);
      };

      Vm.prototype.popFromMem = function(isGlobal) {
        return this._getMemStack(isGlobal).pop();
      };

      Vm.prototype.pushDac = function() {
        this.regStack.push(this._dac);
      };

      Vm.prototype.pushNow = function() {
        logging.debug("Pushing now (" + this._now + ") to stack");
        this.regStack.push(this._now);
      };

      Vm.prototype.pushMe = function() {
        logging.debug("Pushing me to stack:", this._me);
        this.regStack.push(this._me);
      };

      Vm.prototype.suspendUntil = function(time) {
        logging.debug("Suspending VM execution until " + time + " (now: " + this._now + ")");
        this._wakeTime = time;
      };

      Vm.prototype.jumpTo = function(jmp) {
        this._nextPc = jmp;
      };

      Vm.prototype.enterFunctionScope = function() {
        logging.debug("Entering new function scope");
        return this._funcMemStacks.push([]);
      };

      Vm.prototype.exitFunctionScope = function() {
        logging.debug("Exiting current function scope");
        return this._funcMemStacks.pop();
      };

      Vm.prototype._terminateProcessing = function() {
        logging.debug("Terminating processing");
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
        var frame, i, samplesLeft, samplesRight, _i, _j, _ref, _ref1;
        samplesLeft = event.outputBuffer.getChannelData(0);
        samplesRight = event.outputBuffer.getChannelData(1);
        if (this._shouldStop) {
          logging.debug("Audio callback finishing execution after processing " + this._nowSystem + " samples");
          for (i = _i = 0, _ref = event.outputBuffer.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
            samplesLeft[i] = 0;
            samplesRight[i] = 0;
          }
          this._terminateProcessing();
          deferred.resolve();
          return;
        }
        logging.debug("Audio callback processing " + event.outputBuffer.length + " samples");
        for (i = _j = 0, _ref1 = event.outputBuffer.length; 0 <= _ref1 ? _j < _ref1 : _j > _ref1; i = 0 <= _ref1 ? ++_j : --_j) {
          if (this._wakeTime <= (this._nowSystem + 0.5)) {
            this._now = this._wakeTime;
            this._wakeTime = void 0;
            logging.debug("Letting VM compute sample, now: " + this._now);
            this._compute(deferred);
          }
          ++this._nowSystem;
          frame = [0, 0];
          if (!this._shouldStop) {
            this._dac.tick(this._nowSystem, frame);
          }
          samplesLeft[i] = frame[0] * this._gain;
          samplesRight[i] = frame[1] * this._gain;
        }
        if (this._shouldStop) {
          logging.debug("Audio callback: In the process of stopping, flushing buffers");
        }
        logging.debug("Audio callback finished processing, currently at " + this._nowSystem + " samples in total");
      };

      return Vm;

    })();
    return module;
  });

}).call(this);
