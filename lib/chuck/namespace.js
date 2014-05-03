(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty;

  define("chuck/namespace", ["chuck/logging"], function(logging) {
    var ChuckValue, Namespace, Scope, module;
    module = {};
    module.Namespace = Namespace = (function() {
      function Namespace(name, parent) {
        this.exitScope = __bind(this.exitScope, this);
        this.enterScope = __bind(this.enterScope, this);
        this.commit = __bind(this.commit, this);
        this.addValue = __bind(this.addValue, this);
        this.addConstant = __bind(this.addConstant, this);
        this.addVariable = __bind(this.addVariable, this);
        this.findValue = __bind(this.findValue, this);
        this.findType = __bind(this.findType, this);
        this.addType = __bind(this.addType, this);
        this.name = name;
        this._scope = new Scope();
        this._types = new Scope();
        this._parent = parent;
      }

      Namespace.prototype.addType = function(type) {
        this._types.addType(type);
      };

      Namespace.prototype.findType = function(name) {
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

      Namespace.prototype.findValue = function(name, climb) {
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

      Namespace.prototype.addVariable = function(name, type, value, isGlobal) {
        return this._scope.addVariable(name, type, this, value, isGlobal);
      };

      Namespace.prototype.addConstant = function(name, type, value, isGlobal) {
        return this._scope.addConstant(name, type, this, value, isGlobal);
      };

      Namespace.prototype.addValue = function(value, name, isGlobal) {
        if (isGlobal == null) {
          isGlobal = true;
        }
        return this._scope.addValue(value, name, isGlobal);
      };

      Namespace.prototype.commit = function() {
        var scope, _i, _len, _ref;
        _ref = [this._scope, this._types];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          scope = _ref[_i];
          scope.commit();
        }
      };

      Namespace.prototype.enterScope = function() {
        logging.debug("Namespace entering nested scope");
        return this._scope.push();
      };

      Namespace.prototype.exitScope = function() {
        logging.debug("Namespace exiting nested scope");
        return this._scope.pop();
      };

      return Namespace;

    })();
    module.ChuckValue = ChuckValue = (function() {
      function ChuckValue(type, name, owner, isContextGlobal, value, isConstant) {
        this.type = type;
        this.name = name;
        this.owner = owner;
        this.isContextGlobal = isContextGlobal;
        this.value = value;
        this.isConstant = isConstant != null ? isConstant : false;
      }

      return ChuckValue;

    })();
    Scope = (function() {
      function Scope() {
        this.addValue = __bind(this.addValue, this);
        this.commit = __bind(this.commit, this);
        this.addType = __bind(this.addType, this);
        this.findValue = __bind(this.findValue, this);
        this.addConstant = __bind(this.addConstant, this);
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

      Scope.prototype.addVariable = function(name, type, namespace, value, isGlobal) {
        var chuckValue;
        if (isGlobal == null) {
          isGlobal = true;
        }
        chuckValue = new ChuckValue(type, name, namespace, isGlobal, value);
        logging.debug("Scope: Adding variable " + name + " to scope " + (this._scopes.length - 1));
        this.addValue(chuckValue);
        return chuckValue;
      };

      Scope.prototype.addConstant = function(name, type, namespace, value, isGlobal) {
        var chuckValue;
        if (isGlobal == null) {
          isGlobal = true;
        }
        chuckValue = new ChuckValue(type, name, namespace, isGlobal, value, true);
        logging.debug("Scope: Adding constant " + name + " to scope " + (this._scopes.length - 1));
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

      Scope.prototype.addValue = function(value, name) {
        var lastScope;
        if (name == null) {
          name = null;
        }
        name = name != null ? name : value.name;
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
