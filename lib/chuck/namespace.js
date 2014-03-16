(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty;

  define("chuck/namespace", ["chuck/logging"], function(logging) {
    var ChuckValue, Scope, module;
    module = {};
    module.Namespace = (function() {
      function _Class(name, parent) {
        this.exitScope = __bind(this.exitScope, this);
        this.enterScope = __bind(this.enterScope, this);
        this.commit = __bind(this.commit, this);
        this.addValue = __bind(this.addValue, this);
        this.addVariable = __bind(this.addVariable, this);
        this.findValue = __bind(this.findValue, this);
        this.findType = __bind(this.findType, this);
        this.addType = __bind(this.addType, this);
        this.name = name;
        this._scope = new Scope();
        this._types = new Scope();
        this._parent = parent;
      }

      _Class.prototype.addType = function(type) {
        this._types.addType(type);
      };

      _Class.prototype.findType = function(name) {
        var type;
        type = this._types.findType(name);
        if (type != null) {
          return type;
        }
        if (this._parent) {
          return this._parent.findType(name);
        } else {
          return void 0;
        }
      };

      _Class.prototype.findValue = function(name, climb) {
        var val;
        if (climb == null) {
          climb = false;
        }
        val = this._scope.findValue(name, climb);
        if (val != null) {
          return val;
        }
        if (climb && (this._parent != null)) {
          return this._parent.findValue(name, climb);
        }
      };

      _Class.prototype.addVariable = function(name, type, value) {
        return this._scope.addVariable(name, type, this, value);
      };

      _Class.prototype.addValue = function(value) {
        return this._scope.addValue(value);
      };

      _Class.prototype.commit = function() {
        var scope, _i, _len, _ref;
        _ref = [this._scope, this._types];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          scope = _ref[_i];
          scope.commit();
        }
      };

      _Class.prototype.enterScope = function() {
        logging.debug("Namespace entering nested scope");
        return this._scope.push();
      };

      _Class.prototype.exitScope = function() {
        logging.debug("Namespace exiting nested scope");
        return this._scope.pop();
      };

      return _Class;

    })();
    ChuckValue = (function() {
      function ChuckValue(type, varName, namespace, isContextGlobal, value) {
        this.type = type;
        this.name = varName;
        this.owner = namespace;
        this.isContextGlobal = isContextGlobal;
        this.value = value;
      }

      return ChuckValue;

    })();
    Scope = (function() {
      function Scope() {
        this.addValue = __bind(this.addValue, this);
        this.commit = __bind(this.commit, this);
        this.addType = __bind(this.addType, this);
        this.findValue = __bind(this.findValue, this);
        this.addVariable = __bind(this.addVariable, this);
        this.findType = __bind(this.findType, this);
        this.pop = __bind(this.pop, this);
        this.push = __bind(this.push, this);
        this._scopes = [];
        this._commitMap = {};
        this.push();
      }

      Scope.prototype.push = function() {
        return this._scopes.push({});
      };

      Scope.prototype.pop = function() {
        return this._scopes.pop();
      };

      Scope.prototype.findType = function(name) {
        var i, type;
        i = this._scopes.length - 1;
        while (i >= 0) {
          type = this._scopes[i][name];
          if (type != null) {
            return type;
          }
          --i;
        }
        return this._commitMap[name];
      };

      Scope.prototype.addVariable = function(name, type, namespace, value) {
        var chuckValue;
        chuckValue = new ChuckValue(type, name, namespace, void 0, value);
        logging.debug("Scope: Adding variable " + name + " to scope " + (this._scopes.length - 1));
        this.addValue(chuckValue);
        return chuckValue;
      };

      Scope.prototype.findValue = function(name, climb) {
        var lastScope, scope, value, _i, _len, _ref;
        if (!climb) {
          lastScope = this._scopes[this._scopes.length - 1];
          value = lastScope[name];
          if (value != null) {
            return value;
          }
          if (lastScope === this._scopes[0]) {
            return this._commitMap[name];
          } else {
            return null;
          }
        } else {
          _ref = this._scopes.reverse();
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            scope = _ref[_i];
            value = scope[name];
            if (value != null) {
              return value;
            }
          }
          return this._commitMap[name];
        }
      };

      Scope.prototype.addType = function(type) {
        return this.addValue(type);
      };

      Scope.prototype.commit = function() {
        var k, scope, v, _ref;
        scope = this._scopes[0];
        _ref = this._commitMap;
        for (k in _ref) {
          if (!__hasProp.call(_ref, k)) continue;
          v = _ref[k];
          scope[k] = v;
        }
        return this._commitMap = [];
      };

      Scope.prototype.addValue = function(value) {
        var lastScope, name;
        name = value.name;
        lastScope = this._scopes[this._scopes.length - 1];
        if (this._scopes[0] !== lastScope) {
          return lastScope[name] = value;
        } else {
          return this._commitMap[name] = value;
        }
      };

      return Scope;

    })();
    return module;
  });

}).call(this);
