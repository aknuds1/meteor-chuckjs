(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  define("chuck", ["chuck/parserService", "chuck/scanner", "chuck/vm", "chuck/logging", "chuck/audioContextService"], function(parserService, scanner, vmModule, logging, audioContextService) {
    var module;
    module = {};
    module.Chuck = (function() {
      function _Class() {
        this.isExecuting = __bind(this.isExecuting, this);
        this.stop = __bind(this.stop, this);
        this.execute = __bind(this.execute, this);
      }

      _Class.prototype.execute = function(sourceCode) {
        var ast, byteCode;
        audioContextService.prepareForExecution();
        ast = parserService.parse(sourceCode);
        byteCode = scanner.scan(ast);
        this._vm = new vmModule.Vm();
        return this._vm.execute(byteCode);
      };

      _Class.prototype.stop = function() {
        if (!this.isExecuting()) {
          return;
        }
        this._vm.stop();
        return audioContextService.stopOperation();
      };

      _Class.prototype.isExecuting = function() {
        if (this._vm == null) {
          return;
        }
        return this._vm.isExecuting;
      };

      return _Class;

    })();
    module.setLogger = function(logger) {
      return logging.setLogger(logger);
    };
    return module;
  });

}).call(this);
