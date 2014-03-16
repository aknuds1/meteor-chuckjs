(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  define("chuck/audioContextService", ["chuck/logging"], function(logging) {
    var AudioContextService, service;
    AudioContextService = (function() {
      function AudioContextService() {
        this.stopOperation = __bind(this.stopOperation, this);
        this.createScriptProcessor = __bind(this.createScriptProcessor, this);
        this.prepareForExecution = __bind(this.prepareForExecution, this);
        this.getCurrentTime = __bind(this.getCurrentTime, this);
        this.getSampleRate = __bind(this.getSampleRate, this);
        this.createGainNode = __bind(this.createGainNode, this);
        this.createOscillator = __bind(this.createOscillator, this);
      }

      AudioContextService.prototype.createOscillator = function() {
        return this._audioContext.createOscillator();
      };

      AudioContextService.prototype.createGainNode = function() {
        return this._audioContext.createGainNode();
      };

      AudioContextService.prototype.getSampleRate = function() {
        return this._audioContext.sampleRate;
      };

      AudioContextService.prototype.getCurrentTime = function() {
        return this._audioContext.currentTime * this._audioContext.sampleRate;
      };

      AudioContextService.prototype.prepareForExecution = function() {
        var AudioContext;
        if (this._audioContext != null) {
          logging.debug("Re-using AudioContext");
          return;
        }
        logging.debug("Initializing audio context");
        AudioContext = window.AudioContext || window.webkitAudioContext;
        this._audioContext = new AudioContext();
      };

      AudioContextService.prototype.createScriptProcessor = function() {
        this._scriptProcessor = this._audioContext.createScriptProcessor(16384, 0, 2);
        this._scriptProcessor.connect(this._audioContext.destination);
        return this._scriptProcessor;
      };

      AudioContextService.prototype.stopOperation = function() {
        var deferred;
        if (this._scriptProcessor != null) {
          this._scriptProcessor.disconnect(0);
        }
        deferred = Q.defer();
        deferred.resolve();
        return deferred.promise;
      };

      return AudioContextService;

    })();
    service = new AudioContextService();
    return service;
  });

}).call(this);
