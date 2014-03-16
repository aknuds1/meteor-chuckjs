(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  define("chuck/vm", ["chuck/logging", "chuck/ugen", "chuck/types", "q", "chuck/audioContextService"], function(logging, ugen, types, q, audioContextService) {
    var Vm, module;
    module = {};
    Vm = (function() {
      function Vm() {
        this._isRunning = __bind(this._isRunning, this);
        this._terminateProcessing = __bind(this._terminateProcessing, this);
        this.jumpTo = __bind(this.jumpTo, this);
        this.suspendUntil = __bind(this.suspendUntil, this);
        this.pushNow = __bind(this.pushNow, this);
        this.pushDac = __bind(this.pushDac, this);
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
        this.isExecuting = false;
        this._ugens = [];
        this._dac = new ugen.Dac();
        this._wakeTime = void 0;
        this._pc = 0;
        this._nextPc = 1;
        this._shouldStop = false;
        this._now = 0;
        this._nowSystem = 0;
        this._gain = 1;
      }

      Vm.prototype.execute = function(byteCode) {
        var deferred,
          _this = this;
        this._pc = 0;
        this.isExecuting = true;
        deferred = q.defer();
        setTimeout(function() {
          if (!_this._compute(byteCode, deferred)) {
            logging.debug("Ending VM execution");
            _this._terminateProcessing();
            deferred.resolve();
            return;
          }
          logging.debug("Starting audio processing");
          _this._scriptProcessor = audioContextService.createScriptProcessor();
          return _this._scriptProcessor.onaudioprocess = function(event) {
            var frame, i, samplesLeft, samplesRight, _i, _j, _ref, _ref1;
            samplesLeft = event.outputBuffer.getChannelData(0);
            samplesRight = event.outputBuffer.getChannelData(1);
            if (_this._shouldStop) {
              logging.debug("Audio callback finishing execution after processing " + _this._nowSystem + " samples");
              for (i = _i = 0, _ref = event.outputBuffer.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
                samplesLeft[i] = 0;
                samplesRight[i] = 0;
              }
              _this._terminateProcessing();
              deferred.resolve();
              return;
            }
            logging.debug("Audio callback processing " + event.outputBuffer.length + " samples");
            for (i = _j = 0, _ref1 = event.outputBuffer.length; 0 <= _ref1 ? _j < _ref1 : _j > _ref1; i = 0 <= _ref1 ? ++_j : --_j) {
              ++_this._nowSystem;
              if (_this._wakeTime <= (_this._nowSystem + 0.5)) {
                _this._now = _this._wakeTime;
                _this._wakeTime = void 0;
                logging.debug("Letting VM compute sample, now: " + _this._now);
                _this._compute(byteCode, deferred);
              }
              frame = [0, 0];
              if (!_this._shouldStop) {
                _this._dac.tick(_this._nowSystem, frame);
              }
              samplesLeft[i] = frame[0] * _this._gain;
              samplesRight[i] = frame[1] * _this._gain;
              ++_this._nowSystem;
            }
            if (_this._shouldStop) {
              logging.debug("Audio callback: In the process of stopping, flushing buffers");
            }
          };
        }, 0);
        return deferred.promise;
      };

      Vm.prototype.stop = function() {
        logging.debug("Stopping VM");
        this._shouldStop = true;
      };

      Vm.prototype._compute = function(byteCode, deferred) {
        var err, instr, sampleRate;
        try {
          if (this._pc === 0) {
            logging.debug("VM executing");
          } else {
            logging.debug("Resuming VM execution");
          }
          while (this._pc < byteCode.length && this._isRunning()) {
            instr = byteCode[this._pc];
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
            this._shouldStop = true;
            logging.debug("VM execution has ended at " + this._nowSystem + " samples", this._shouldStop);
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
          throw new Error('value is undefined');
        }
        this.regStack.push(value);
      };

      Vm.prototype.pushMemAddrToReg = function(offset) {
        var value;
        value = this.memStack[offset];
        logging.debug("Pushing memory stack address " + offset + " (" + value + ") to regular stack");
        return this.regStack.push(offset);
      };

      Vm.prototype.pushToRegFromMem = function(offset) {
        var value;
        value = this.memStack[offset];
        logging.debug("Pushing memory stack value @" + offset + " to regular stack:", value);
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

      Vm.prototype.insertIntoMemory = function(index, value) {
        logging.debug("Inserting value " + value + " (" + (typeof value) + ") into memory stack at index " + index);
        this.memStack[index] = value;
      };

      Vm.prototype.removeFromMemory = function(index) {
        logging.debug("Removing element " + index + " of memory stack");
        this.memStack.splice(index, 1);
      };

      Vm.prototype.getFromMemory = function(index) {
        var val;
        val = this.memStack[index];
        logging.debug("Getting value from memory stack at index " + index + ": " + val);
        return val;
      };

      Vm.prototype.pushToMem = function(value) {
        if (value == null) {
          throw new Error('value is undefined');
        }
        return this.memStack.push(value);
      };

      Vm.prototype.pushDac = function() {
        this.regStack.push(this._dac);
      };

      Vm.prototype.pushNow = function() {
        logging.debug("Pushing now (" + this._now + ") to stack");
        this.regStack.push(this._now);
      };

      Vm.prototype.suspendUntil = function(time) {
        logging.debug("Suspending VM execution until " + time);
        this._wakeTime = time;
      };

      Vm.prototype.jumpTo = function(jmp) {
        this._nextPc = jmp;
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

      Vm.prototype._isRunning = function() {
        return (this._wakeTime == null) && !this._shouldStop;
      };

      return Vm;

    })();
    module.Vm = Vm;
    return module;
  });

}).call(this);
