(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  define("chuck/ugen", ["chuck/types", "chuck/logging"], function(types, logging) {
    var Dac, UGen, UGenChannel, module;
    module = {};
    UGenChannel = (function() {
      function UGenChannel() {
        this.stop = __bind(this.stop, this);
        this.remove = __bind(this.remove, this);
        this.add = __bind(this.add, this);
        this.tick = __bind(this.tick, this);
        this.current = 0;
        this.sources = [];
      }

      UGenChannel.prototype.tick = function(now) {
        var i, source, ugen, _i, _len, _ref;
        this.current = 0;
        if (this.sources.length === 0) {
          return this.current;
        }
        ugen = this.sources[0];
        ugen.tick(now);
        this.current = ugen.current;
        _ref = (function() {
          var _j, _ref, _results;
          _results = [];
          for (i = _j = 1, _ref = this.sources.length; 1 <= _ref ? _j < _ref : _j > _ref; i = 1 <= _ref ? ++_j : --_j) {
            _results.push(this.sources[i]);
          }
          return _results;
        }).call(this);
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          source = _ref[_i];
          source.tick(now);
          this.current += source.current;
        }
        return this.current;
      };

      UGenChannel.prototype.add = function(source) {
        logging.debug("UGen channel: Adding source #" + this.sources.length);
        this.sources.push(source);
      };

      UGenChannel.prototype.remove = function(source) {
        var idx;
        idx = _.find(this.sources, function(src) {
          return src === source;
        });
        logging.debug("UGen channel: Removing source #" + idx);
        this.sources.splice(idx, 1);
      };

      UGenChannel.prototype.stop = function() {
        return this.sources.splice(0, this.sources.length);
      };

      return UGenChannel;

    })();
    module.UGen = UGen = (function() {
      function UGen(type) {
        this._removeDest = __bind(this._removeDest, this);
        this._addDest = __bind(this._addDest, this);
        this.tick = __bind(this.tick, this);
        this.setGain = __bind(this.setGain, this);
        this.stop = __bind(this.stop, this);
        this.remove = __bind(this.remove, this);
        this.add = __bind(this.add, this);
        var i;
        this.type = type;
        this.size = this.type.size;
        this.pmsg = this.type.ugenPmsg;
        this.numIns = this.type.ugenNumIns;
        this.numOuts = this.type.ugenNumOuts;
        this._channels = (function() {
          var _i, _ref, _results;
          _results = [];
          for (i = _i = 0, _ref = this.numIns; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
            _results.push(new UGenChannel());
          }
          return _results;
        }).call(this);
        this._tick = type.ugenTick != null ? _.bind(type.ugenTick, this) : function(input) {
          return input;
        };
        this._now = -1;
        this._destList = [];
        this._gain = 1;
      }

      UGen.prototype.add = function(src) {
        var channel, _i, _len, _ref;
        _ref = this._channels;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          channel = _ref[_i];
          channel.add(src);
        }
        src._addDest(this);
      };

      UGen.prototype.remove = function(src) {
        var channel, _i, _len, _ref;
        _ref = this._channels;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          channel = _ref[_i];
          channel.remove(src);
        }
        src._removeDest(this);
      };

      UGen.prototype.stop = function() {
        var channel, _i, _len, _ref;
        _ref = this._channels;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          channel = _ref[_i];
          channel.stop();
        }
        if (this._destList.length === 0) {
          return;
        }
        this._destList.splice(0, this._destList.length);
      };

      UGen.prototype.setGain = function(gain) {
        this._gain = gain;
        return gain;
      };

      UGen.prototype.tick = function(now) {
        var channel, sum, _i, _len, _ref;
        if (this._now >= now) {
          return this.current;
        }
        this._now = now;
        sum = 0;
        _ref = this._channels;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          channel = _ref[_i];
          sum += channel.tick(now);
        }
        sum /= this._channels.length;
        this.current = this._tick(sum) * this._gain;
        return this.current;
      };

      UGen.prototype._addDest = function(dest) {
        this._destList.push(dest);
      };

      UGen.prototype._removeDest = function(dest) {
        var idx;
        idx = _.find(this._destList, function(d) {
          return d === dest;
        });
        logging.debug("UGen: Removing destination " + idx);
        this._destList.splice(idx, 1);
      };

      return UGen;

    })();
    module.Dac = Dac = (function(_super) {
      __extends(Dac, _super);

      function Dac() {
        this.tick = __bind(this.tick, this);
        Dac.__super__.constructor.call(this, types.types.Dac);
      }

      Dac.prototype.tick = function(now, frame) {
        var i, _i, _ref;
        Dac.__super__.tick.call(this, now);
        for (i = _i = 0, _ref = frame.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
          frame[i] = this._channels[i].current;
        }
      };

      return Dac;

    })(UGen);
    return module;
  });

}).call(this);
