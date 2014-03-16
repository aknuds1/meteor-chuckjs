/**
 * @license almond 0.2.9 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                name = baseParts.concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("almond", function(){});

(function() {
  define('chuck/helpers', [], function() {
    var module;
    module = {};
    module.count = function(string, substr) {
      var num, pos;
      num = pos = 0;
      if (!substr.length) {
        return 1 / 0;
      }
      while (pos = 1 + string.indexOf(substr, pos)) {
        num++;
      }
      return num;
    };
    module.last = function(array, back) {
      return array[array.length - (back || 0) - 1];
    };
    module.throwSyntaxError = function(message, location) {
      var error;
      error = new SyntaxError(message);
      error.location = location;
      error.toString = syntaxErrorToString;
      error.stack = error.toString();
      throw error;
    };
    return module;
  });

}).call(this);

(function() {
  define("chuck/logging", [], function() {
    var logger, methods, module, name, _i, _len;
    logger = void 0;
    module = {};
    methods = ['error', 'warn', 'info', 'debug', 'trace'];
    for (_i = 0, _len = methods.length; _i < _len; _i++) {
      name = methods[_i];
      module[name] = function() {
        return void 0;
      };
    }
    module.setLogger = function(logger) {
      var _j, _len1, _results;
      _results = [];
      for (_j = 0, _len1 = methods.length; _j < _len1; _j++) {
        name = methods[_j];
        if (!_.isFunction(logger[name])) {
          throw new Error("Logger lacks method " + name);
        }
        _results.push(module[name] = _.bind(logger[name], logger));
      }
      return _results;
    };
    return module;
  });

}).call(this);

(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty;

  define("chuck/lexer", ["chuck/helpers", "chuck/logging"], function(helpers, logging) {
    var BOM, COMMENT, FLOAT, IDENTIFIER, Lexer, MATCHERS, NUMBER, TRAILING_SPACES, WHITESPACE, count, last, throwSyntaxError;
    count = helpers.count, last = helpers.last, throwSyntaxError = helpers.throwSyntaxError;
    Lexer = (function() {
      function Lexer() {
        this._matchToken = __bind(this._matchToken, this);
      }

      Lexer.prototype.tokenize = function(code) {
        var consumed, i, k, tag, v, _ref;
        this.ends = [];
        this.tokens = [];
        this.chunkLine = 0;
        this.chunkColumn = 0;
        code = this.clean(code);
        this._matchers = [];
        for (k in MATCHERS) {
          if (!__hasProp.call(MATCHERS, k)) continue;
          v = MATCHERS[k];
          this._matchers.push([new RegExp("^" + k), v]);
        }
        i = 0;
        while (this.chunk = code.slice(i)) {
          consumed = this.floatToken() || this.intToken() || this._matchToken() || this.identifierToken() || this.commentToken() || this.whitespaceToken() || this.stringToken() || this.literalToken();
          _ref = this.getLineAndColumnFromChunk(consumed), this.chunkLine = _ref[0], this.chunkColumn = _ref[1];
          i += consumed;
        }
        if (tag = this.ends.pop()) {
          this.error("missing " + tag);
        }
        return this.tokens;
      };

      Lexer.prototype.clean = function(code) {
        if (code.charCodeAt(0) === BOM) {
          code = code.slice(1);
        }
        code = code.replace(/\r/g, '').replace(TRAILING_SPACES, '');
        if (WHITESPACE.test(code)) {
          code = "\n" + code;
          --this.chunkLine;
        }
        return code;
      };

      Lexer.prototype.identifierToken = function() {
        var id, idLength, match, poppedToken, tag, tagToken, _ref;
        if (!(match = IDENTIFIER.exec(this.chunk))) {
          return 0;
        }
        id = match[0];
        logging.debug("Token is an identifier: '" + id + "'");
        idLength = id.length;
        poppedToken = void 0;
        tag = 'ID';
        tagToken = this.token(tag, id, 0, idLength);
        if (poppedToken) {
          _ref = [poppedToken[2].first_line, poppedToken[2].first_column], tagToken[2].first_line = _ref[0], tagToken[2].first_column = _ref[1];
        }
        return id.length;
      };

      Lexer.prototype.intToken = function() {
        var binaryLiteral, lexedLength, match, number, octalLiteral;
        if (!(match = NUMBER.exec(this.chunk))) {
          return 0;
        }
        number = match[0];
        logging.debug("Token is an integer: " + number);
        if (/^0[BOX]/.test(number)) {
          this.error("radix prefix '" + number + "' must be lowercase");
        } else if (/^0\d*[89]/.test(number)) {
          this.error("decimal literal '" + number + "' must not be prefixed with '0'");
        } else if (/^0\d+/.test(number)) {
          this.error("octal literal '" + number + "' must be prefixed with '0o'");
        }
        lexedLength = number.length;
        if (octalLiteral = /^0o([0-7]+)/.exec(number)) {
          number = '0x' + parseInt(octalLiteral[1], 8).toString(16);
        }
        if (binaryLiteral = /^0b([01]+)/.exec(number)) {
          number = '0x' + parseInt(binaryLiteral[1], 2).toString(16);
        }
        this.token('NUMBER', number, 0, lexedLength);
        return lexedLength;
      };

      Lexer.prototype.floatToken = function() {
        var lexedLength, match, number;
        if (!(match = FLOAT.exec(this.chunk))) {
          return 0;
        }
        number = match[0];
        logging.debug("Token is a float: " + number);
        if (/E/.test(number) && !/^0x/.test(number)) {
          this.error("exponential notation '" + number + "' must be indicated with a lowercase 'e'");
        }
        lexedLength = number.length;
        this.token('FLOAT', number, 0, lexedLength);
        return lexedLength;
      };

      Lexer.prototype.stringToken = function() {
        var match, string;
        if (!(match = /^"(.+)"/.exec(this.chunk))) {
          return 0;
        }
        string = match[1];
        logging.debug("Token is a string: '" + string + "', " + string.length);
        this.token('STRING_LIT', string);
        return match[0].length;
      };

      Lexer.prototype.commentToken = function() {
        var comment, match;
        if (!(match = this.chunk.match(COMMENT))) {
          return 0;
        }
        comment = match[0];
        logging.debug("Token is a comment", comment);
        return comment.length;
      };

      Lexer.prototype.whitespaceToken = function() {
        var match, nline, prev;
        if (!((match = WHITESPACE.exec(this.chunk)) || (nline = this.chunk.charAt(0) === '\n'))) {
          return 0;
        }
        if (match != null) {
          logging.debug("Consuming whitespace");
        }
        prev = last(this.tokens);
        if (prev) {
          prev[match ? 'spaced' : 'newLine'] = true;
        }
        if (match) {
          return match[0].length;
        } else {
          return 0;
        }
      };

      Lexer.prototype.literalToken = function() {
        var match, tag, value;
        if (match = /^;/.exec(this.chunk)) {
          value = match[0];
          tag = 'SEMICOLON';
          logging.debug('Token is a semicolon');
        } else {
          value = this.chunk;
          logging.debug("Unmatched token: '" + value + "'");
        }
        this.token(tag, value);
        return value.length;
      };

      Lexer.prototype._matchToken = function() {
        var match, matcher, re, token, value, _i, _len, _ref;
        _ref = this._matchers;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          matcher = _ref[_i];
          re = matcher[0], token = matcher[1];
          match = re.exec(this.chunk);
          if (match == null) {
            continue;
          }
          value = match[0];
          logging.debug("Matched text '" + value + "' against token " + token);
          this.token(token, value);
          return value.length;
        }
        return 0;
      };

      Lexer.prototype.getLineAndColumnFromChunk = function(offset) {
        var column, lineCount, lines, string;
        if (offset === 0) {
          return [this.chunkLine, this.chunkColumn];
        }
        if (offset >= this.chunk.length) {
          string = this.chunk;
        } else {
          string = this.chunk.slice(0, offset);
        }
        lineCount = count(string, '\n');
        column = this.chunkColumn;
        if (lineCount > 0) {
          lines = string.split('\n');
          column = last(lines).length;
        } else {
          column += string.length;
        }
        return [this.chunkLine + lineCount, column];
      };

      Lexer.prototype.makeToken = function(tag, value, offsetInChunk, length) {
        var lastCharacter, locationData, token, _ref, _ref1;
        if (offsetInChunk == null) {
          offsetInChunk = 0;
        }
        if (length == null) {
          length = value.length;
        }
        locationData = {};
        _ref = this.getLineAndColumnFromChunk(offsetInChunk), locationData.first_line = _ref[0], locationData.first_column = _ref[1];
        lastCharacter = Math.max(0, length - 1);
        _ref1 = this.getLineAndColumnFromChunk(offsetInChunk + lastCharacter), locationData.last_line = _ref1[0], locationData.last_column = _ref1[1];
        token = [tag, value, locationData];
        return token;
      };

      Lexer.prototype.token = function(tag, value, offsetInChunk, length) {
        var token;
        token = this.makeToken(tag, value, offsetInChunk, length);
        this.tokens.push(token);
        logging.debug("Pushed token '" + token[0] + "'");
        return token;
      };

      Lexer.prototype.error = function(message, offset) {
        var first_column, first_line, _ref;
        if (offset == null) {
          offset = 0;
        }
        _ref = this.getLineAndColumnFromChunk(offset), first_line = _ref[0], first_column = _ref[1];
        return throwSyntaxError(message, {
          first_line: first_line,
          first_column: first_column
        });
      };

      return Lexer;

    })();
    BOM = 65279;
    IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*/;
    NUMBER = /^0[xX][0-9a-fA-F]+|^0[cC][0-7]+|^[0-9]+/i;
    FLOAT = /^(?:\d+\.\d*)|^(?:\d*\.\d+)/i;
    WHITESPACE = /^\s+/;
    COMMENT = /^(?:\s*\/\/.*)+/;
    TRAILING_SPACES = /\s+$/;
    MATCHERS = {
      '\\+\\+': 'PLUSPLUS',
      '\\-\\-': 'MINUSMINUS',
      ',': 'COMMA',
      '=>': 'CHUCK',
      '=<': 'UNCHUCK',
      '::': 'COLONCOLON',
      '<<<': 'L_HACK',
      '>>>': 'R_HACK',
      'while': 'WHILE',
      'for': 'FOR',
      '\\(': 'LPAREN',
      '\\)': 'RPAREN',
      '\\{': 'LBRACE',
      '\\}': 'RBRACE',
      'break': 'BREAK',
      '\\.': 'DOT',
      '\\+': 'PLUS',
      '-': 'MINUS',
      '\\*': 'TIMES',
      '<': 'LT',
      '>': 'GT',
      '\\[': 'LBRACK',
      '\\]': 'RBRACK'
    };
    return {
      tokenize: function(sourceCode) {
        return new Lexer().tokenize(sourceCode);
      }
    };
  });

}).call(this);

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
        logging.debug("Initializing audio context");
        AudioContext = window.AudioContext || window.webkitAudioContext;
        return this._audioContext = new AudioContext();
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

(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  define("chuck/types", ["chuck/audioContextService", "chuck/namespace"], function(audioContextService, namespace) {
    var ChuckFunctionBase, ChuckMethod, ChuckStaticMethod, ChuckType, FunctionArg, FunctionOverload, OscData, TwoPi, constructDac, constructObject, constructOsc, module, oscNamespace, tickSinOsc, types, ugenNamespace;
    module = {};
    TwoPi = Math.PI * 2;
    module.ChuckType = ChuckType = (function() {
      function ChuckType(name, parent, opts, constructorCb) {
        this._constructParent = __bind(this._constructParent, this);
        this.findValue = __bind(this.findValue, this);
        this.isOfType = __bind(this.isOfType, this);
        var k, memberType, v, _ref;
        opts = opts || {};
        this.name = name;
        this.parent = parent;
        this.size = opts.size;
        this._constructor = constructorCb;
        this._opts = opts;
        this._namespace = new namespace.Namespace();
        this._constructParent(parent, this._opts);
        if (constructorCb != null) {
          constructorCb.call(this, this._opts);
        }
        opts.namespace = opts.namespace || {};
        _ref = opts.namespace;
        for (k in _ref) {
          if (!__hasProp.call(_ref, k)) continue;
          v = _ref[k];
          memberType = v instanceof ChuckFunctionBase ? types.Function : void 0;
          this._namespace.addVariable(k, memberType, v);
        }
      }

      ChuckType.prototype.isOfType = function(otherType) {
        var parent;
        if (this.name === otherType.name) {
          return true;
        }
        parent = this.parent;
        while (parent != null) {
          if (parent.isOfType(otherType)) {
            return true;
          }
          parent = parent.parent;
        }
        return false;
      };

      ChuckType.prototype.findValue = function(name) {
        var val;
        val = this._namespace.findValue(name);
        if (val != null) {
          return val;
        }
        if (this.parent != null) {
          return this.parent.findValue(name);
        }
      };

      ChuckType.prototype._constructParent = function(parent, opts) {
        if (parent == null) {
          return;
        }
        opts = _({}).chain().extend(parent._opts).extend(opts).value();
        this._constructParent(parent.parent, opts);
        if (parent._constructor != null) {
          return parent._constructor.call(this, opts);
        }
      };

      return ChuckType;

    })();
    types = module.types = {};
    types.int = new ChuckType("int", void 0, {
      size: 8,
      preConstructor: void 0
    });
    types.float = new ChuckType("float", void 0, {
      size: 8,
      preConstructor: void 0
    });
    types.Time = new ChuckType("time", void 0, {
      size: 8,
      preConstructor: void 0
    });
    types.Dur = new ChuckType("Dur", void 0, {
      size: 8,
      preConstructor: void 0
    });
    types.String = new ChuckType("String", void 0, {
      size: 8,
      preConstructor: void 0
    });
    module.FunctionArg = FunctionArg = (function() {
      function FunctionArg(name, type) {
        this.name = name;
        this.type = type;
      }

      return FunctionArg;

    })();
    module.FunctionOverload = FunctionOverload = (function() {
      function FunctionOverload(args, func) {
        this.apply = __bind(this.apply, this);
        this["arguments"] = args;
        this.func = func;
        this.stackDepth = args.length;
      }

      FunctionOverload.prototype.apply = function(obj) {
        return this.func.apply(arguments[0], arguments[1]);
      };

      return FunctionOverload;

    })();
    ChuckFunctionBase = (function() {
      function ChuckFunctionBase(name, overloads, isMember, typeName, retType) {
        var i, overload, _i, _len;
        this.name = name;
        this.isMember = isMember;
        this._overloads = overloads;
        this.retType = retType;
        i = 0;
        for (_i = 0, _len = overloads.length; _i < _len; _i++) {
          overload = overloads[_i];
          overload.name = "" + name + "@" + (i++);
          overload.isMember = this.isMember;
          overload.retType = retType;
          if (this.isMember) {
            ++overload.stackDepth;
          }
          if (typeName != null) {
            overload.name = "" + overload.name + "@" + typeName;
          }
        }
      }

      ChuckFunctionBase.prototype.findOverload = function(args) {
        var mthd, _i, _len, _ref;
        _ref = this._overloads;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          mthd = _ref[_i];
          if (mthd["arguments"].length !== args.length) {
            continue;
          }
          if (!_.every(mthd["arguments"], function(a, index) {
            return a.type === args[index].type || (a.type === types.float && args[index].type === types.int);
          })) {
            continue;
          }
          return mthd;
        }
        return null;
      };

      return ChuckFunctionBase;

    })();
    module.ChuckMethod = ChuckMethod = (function(_super) {
      __extends(ChuckMethod, _super);

      function ChuckMethod(name, overloads, typeName, retType) {
        ChuckMethod.__super__.constructor.call(this, name, overloads, true, typeName, retType);
      }

      return ChuckMethod;

    })(ChuckFunctionBase);
    module.ChuckStaticMethod = ChuckStaticMethod = (function(_super) {
      __extends(ChuckStaticMethod, _super);

      function ChuckStaticMethod(name, overloads, typeName, retType) {
        ChuckStaticMethod.__super__.constructor.call(this, name, overloads, false, typeName, retType);
        this.isStatic = true;
      }

      return ChuckStaticMethod;

    })(ChuckFunctionBase);
    types.Function = new ChuckType("Function", null, null);
    constructObject = function() {};
    types.Object = new ChuckType("Object", void 0, {
      preConstructor: constructObject
    }, function(opts) {
      this.hasConstructor = opts.preConstructor != null;
      this.preConstructor = opts.preConstructor;
      return this.size = opts.size;
    });
    module.Class = new ChuckType("Class", types.Object);
    ugenNamespace = {
      gain: new ChuckMethod("gain", [
        new FunctionOverload([new FunctionArg("value", types.float)], function(value) {
          return this.setGain(value);
        })
      ], "UGen", types.float)
    };
    types.UGen = new ChuckType("UGen", types.Object, {
      size: 8,
      numIns: 1,
      numOuts: 1,
      preConstructor: void 0,
      namespace: ugenNamespace,
      ugenTick: void 0
    }, function(opts) {
      this.ugenNumIns = opts.numIns;
      this.ugenNumOuts = opts.numOuts;
      return this.ugenTick = opts.ugenTick;
    });
    OscData = (function() {
      function OscData() {
        this.num = 0.0;
        this.sync = 0;
        this.width = 0.5;
        this.phase = 0;
      }

      return OscData;

    })();
    oscNamespace = {
      freq: new ChuckMethod("freq", [
        new FunctionOverload([new FunctionArg("value", types.float)], function(value) {
          return this.setFrequency(value);
        })
      ], "Osc", types.float)
    };
    constructOsc = function() {
      this.data = new OscData();
      this.setFrequency = function(value) {
        this.data.num = (1 / audioContextService.getSampleRate()) * value;
        return value;
      };
      return this.setFrequency(220);
    };
    types.Osc = new ChuckType("Osc", types.UGen, {
      numIns: 1,
      numOuts: 1,
      preConstructor: constructOsc,
      namespace: oscNamespace
    });
    tickSinOsc = function() {
      var out;
      out = Math.sin(this.data.phase * TwoPi);
      this.data.phase += this.data.num;
      if (this.data.phase > 1) {
        this.data.phase -= 1;
      } else if (this.data.phase < 0) {
        this.data.phase += 1;
      }
      return out;
    };
    types.SinOsc = new ChuckType("SinOsc", types.Osc, {
      preConstructor: void 0,
      ugenTick: tickSinOsc
    });
    types.UGenStereo = new ChuckType("Ugen_Stereo", types.UGen, {
      numIns: 2,
      numOuts: 2,
      preConstructor: void 0
    });
    constructDac = function() {
      return this._node = audioContextService.outputNode;
    };
    types.Dac = new ChuckType("Dac", types.UGenStereo, {
      preConstructor: constructDac
    });
    types["void"] = new ChuckType("void");
    module.isObj = function(type) {
      return !module.isPrimitive(type);
    };
    module.isPrimitive = function(type) {
      return type === types.Dur || type === types.Time || type === types.int || type === types.float;
    };
    return module;
  });

}).call(this);

(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  define("chuck/nodes", ["chuck/types", "chuck/logging", "chuck/audioContextService"], function(typesModule, logging, audioContextService) {
    var AdditiveSubtractiveOperatorBase, ExpressionBase, ExpressionList, GtLtOperatorBase, NodeBase, ParentNodeBase, PlusPlusOperatorBase, TimesOperator, module, types;
    module = {};
    types = typesModule.types;
    NodeBase = (function() {
      function NodeBase(nodeType) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        this.scanPass1 = __bind(this.scanPass1, this);
        this.nodeType = nodeType;
      }

      NodeBase.prototype.scanPass1 = function() {};

      NodeBase.prototype.scanPass2 = function() {};

      NodeBase.prototype.scanPass3 = function() {};

      NodeBase.prototype.scanPass4 = function() {};

      NodeBase.prototype.scanPass5 = function() {};

      return NodeBase;

    })();
    ParentNodeBase = (function() {
      function ParentNodeBase(child, nodeType) {
        this._scanArray = __bind(this._scanArray, this);
        this._scanPass = __bind(this._scanPass, this);
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        this.scanPass1 = __bind(this.scanPass1, this);
        this._child = child;
        this.nodeType = nodeType;
      }

      ParentNodeBase.prototype.scanPass1 = function(context) {
        return this._scanPass(1, context);
      };

      ParentNodeBase.prototype.scanPass2 = function(context) {
        return this._scanPass(2, context);
      };

      ParentNodeBase.prototype.scanPass3 = function(context) {
        return this._scanPass(3, context);
      };

      ParentNodeBase.prototype.scanPass4 = function(context) {
        return this._scanPass(4, context);
      };

      ParentNodeBase.prototype.scanPass5 = function(context) {
        return this._scanPass(5, context);
      };

      ParentNodeBase.prototype._scanPass = function(pass, context) {
        if (!this._child) {
          return;
        }
        if (_(this._child).isArray()) {
          return this._scanArray(this._child, pass, context);
        } else {
          return this._child["scanPass" + pass](context);
        }
      };

      ParentNodeBase.prototype._scanArray = function(array, pass, context) {
        var c, _i, _len;
        for (_i = 0, _len = array.length; _i < _len; _i++) {
          c = array[_i];
          if (_(c).isArray()) {
            this._scanArray(c, pass, context);
          } else {
            c["scanPass" + pass](context);
          }
        }
      };

      return ParentNodeBase;

    })();
    module.Program = (function(_super) {
      __extends(_Class, _super);

      function _Class(child) {
        _Class.__super__.constructor.call(this, child, "Program");
      }

      return _Class;

    })(ParentNodeBase);
    module.ExpressionStatement = (function(_super) {
      __extends(_Class, _super);

      function _Class(exp) {
        this.scanPass5 = __bind(this.scanPass5, this);
        _Class.__super__.constructor.call(this, exp, "ExpressionStatement");
      }

      _Class.prototype.scanPass5 = function(context, opts) {
        var shouldPop;
        opts = opts || {};
        shouldPop = opts.pop != null ? opts.pop : true;
        this._child.scanPass5(context);
        if ((this._child.type != null) && this._child.type.size > 0) {
          if (shouldPop) {
            logging.debug("ExpressionStatement: Emitting PopWord to remove superfluous return value");
            return context.emitPopWord();
          }
        } else {
          return logging.debug("ExpressionStatement: Child expression has no return value");
        }
      };

      return _Class;

    })(ParentNodeBase);
    module.BinaryExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(exp1, operator, exp2) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        _Class.__super__.constructor.call(this, "BinaryExpression");
        this.exp1 = exp1;
        this.operator = operator;
        this.exp2 = exp2;
      }

      _Class.prototype.scanPass2 = function(context) {
        this.exp1.scanPass2(context);
        this.exp2.scanPass2(context);
      };

      _Class.prototype.scanPass3 = function(context) {
        this.exp1.scanPass3(context);
        this.exp2.scanPass3(context);
      };

      _Class.prototype.scanPass4 = function(context) {
        this.exp1.scanPass4(context);
        logging.debug("BinaryExpression " + this.operator.name + ": Type checked LHS, type " + this.exp1.type.name);
        this.exp2.scanPass4(context);
        logging.debug("BinaryExpression " + this.operator.name + ": Type checked RHS, type " + this.exp2.type.name);
        this.type = this.operator.check(this.exp1, this.exp2, context);
        logging.debug("BinaryExpression " + this.operator.name + ": Type checked operator, type " + this.type.name);
      };

      _Class.prototype.scanPass5 = function(context) {
        logging.debug("Binary expression " + this.operator.name + ": Emitting LHS");
        this.exp1.scanPass5(context);
        logging.debug("Binary expression " + this.operator.name + ": Emitting RHS");
        this.exp2.scanPass5(context);
        logging.debug("Binary expression " + this.operator.name + ": Emitting operator");
        this.operator.emit(context, this.exp1, this.exp2);
      };

      return _Class;

    })(NodeBase);
    ExpressionBase = (function(_super) {
      __extends(ExpressionBase, _super);

      function ExpressionBase(nodeType, meta) {
        this.scanPass4 = __bind(this.scanPass4, this);
        ExpressionBase.__super__.constructor.call(this, nodeType);
        this._meta = meta;
      }

      ExpressionBase.prototype.scanPass4 = function() {
        this.groupSize = 0;
        return ++this.groupSize;
      };

      return ExpressionBase;

    })(NodeBase);
    module.ExpressionList = ExpressionList = (function(_super) {
      __extends(ExpressionList, _super);

      function ExpressionList(expression) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this._scanPass = __bind(this._scanPass, this);
        this.prepend = __bind(this.prepend, this);
        ExpressionList.__super__.constructor.call(this, "ExpressionList");
        this._expressions = [expression];
      }

      ExpressionList.prototype.prepend = function(expression) {
        this._expressions.splice(0, 0, expression);
        return this;
      };

      ExpressionList.prototype._scanPass = function(pass) {
        var exp, _i, _len, _ref;
        _ref = this._expressions;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          exp = _ref[_i];
          exp["scanPass" + pass].apply(exp, Array.prototype.slice.call(arguments, 1));
        }
      };

      ExpressionList.prototype.scanPass1 = _.partial(ExpressionList.prototype._scanPass, 1);

      ExpressionList.prototype.scanPass2 = _.partial(ExpressionList.prototype._scanPass, 2);

      ExpressionList.prototype.scanPass3 = _.partial(ExpressionList.prototype._scanPass, 3);

      ExpressionList.prototype.scanPass4 = _.partial(ExpressionList.prototype._scanPass, 4);

      ExpressionList.prototype.scanPass5 = function(context) {
        var exp;
        this._scanPass(5, context);
        return this.types = (function() {
          var _i, _len, _ref, _results;
          _ref = this._expressions;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            exp = _ref[_i];
            _results.push(exp.type);
          }
          return _results;
        }).call(this);
      };

      return ExpressionList;

    })(ExpressionBase);
    module.DeclarationExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(typeDecl, varDecls) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        _Class.__super__.constructor.call(this, "DeclarationExpression");
        this.typeDecl = typeDecl;
        this.varDecls = varDecls;
      }

      _Class.prototype.scanPass2 = function(context) {
        this.type = context.findType(this.typeDecl.type);
        logging.debug("Variable declaration of type " + this.type.name);
        return void 0;
      };

      _Class.prototype.scanPass3 = function(context) {
        var varDecl, _i, _len, _ref;
        _ref = this.varDecls;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          varDecl = _ref[_i];
          logging.debug("Adding variable '" + varDecl.name + "' of type " + this.type.name + " to current namespace");
          varDecl.value = context.addVariable(varDecl.name, this.type);
        }
        return void 0;
      };

      _Class.prototype.scanPass4 = function(context) {
        var varDecl, _i, _len, _ref;
        _Class.__super__.scanPass4.call(this);
        _ref = this.varDecls;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          varDecl = _ref[_i];
          logging.debug("" + this.nodeType + " Checking variable " + varDecl.name);
          varDecl.value.isDeclChecked = true;
          context.addValue(varDecl.value);
        }
      };

      _Class.prototype.scanPass5 = function(context) {
        var varDecl, _i, _len, _ref;
        _Class.__super__.scanPass5.call(this);
        _ref = this.varDecls;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          varDecl = _ref[_i];
          if (varDecl.array != null) {
            logging.debug("" + this.nodeType + ": Instantiating array", varDecl);
          } else {
            logging.debug("" + this.nodeType + ": Emitting Assignment for value " + varDecl.value);
          }
        }
        context.emitAssignment(this.type, varDecl);
      };

      return _Class;

    })(ExpressionBase);
    module.TypeDeclaration = (function(_super) {
      __extends(_Class, _super);

      function _Class(type) {
        _Class.__super__.constructor.call(this, "TypeDeclaration");
        this.type = type;
      }

      return _Class;

    })(NodeBase);
    module.VariableDeclaration = (function(_super) {
      __extends(_Class, _super);

      function _Class(name, array) {
        _Class.__super__.constructor.call(this, "VariableDeclaration");
        this.name = name;
        this.array = array;
      }

      return _Class;

    })(NodeBase);
    module.PrimaryVariableExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(name) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        _Class.__super__.constructor.call(this, "PrimaryVariableExpression", "variable");
        this.name = name;
        this._emitVar = false;
      }

      _Class.prototype.scanPass4 = function(context) {
        _Class.__super__.scanPass4.call(this);
        switch (this.name) {
          case "dac":
            this._meta = "value";
            this.type = types.Dac;
            break;
          case "second":
            this.type = types.Dur;
            break;
          case "now":
            this.type = types.Time;
            break;
          case "true":
            this._meta = "value";
            return this.type = types.int;
          default:
            this.value = context.findValue(this.name);
            if (this.value == null) {
              context.findValue(this.name, true);
            }
            this.type = this.value.type;
            logging.debug("Primary variable of type " + this.type.name);
            return this.type;
        }
      };

      _Class.prototype.scanPass5 = function(context) {
        _Class.__super__.scanPass5.call(this);
        switch (this.name) {
          case "dac":
            context.emitDac();
            break;
          case "second":
            context.emitRegPushImm(audioContextService.getSampleRate());
            break;
          case "now":
            context.emitRegPushNow();
            break;
          case "true":
            context.emitRegPushImm(1);
            break;
          default:
            if (this._emitVar) {
              logging.debug("" + this.nodeType + ": Emitting RegPushMemAddr (" + this.value.offset + ") since this is a variable");
              context.emitRegPushMemAddr(this.value.offset);
            } else {
              logging.debug("" + this.nodeType + ": Emitting RegPushMem (" + this.value.offset + ") since this is a constant");
              context.emitRegPushMem(this.value.offset);
            }
        }
        return void 0;
      };

      return _Class;

    })(ExpressionBase);
    module.PrimaryIntExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(value) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        _Class.__super__.constructor.call(this, "PrimaryIntExpression", "value");
        this.value = parseInt(value);
      }

      _Class.prototype.scanPass4 = function() {
        _Class.__super__.scanPass4.call(this);
        return this.type = types.int;
      };

      _Class.prototype.scanPass5 = function(context) {
        _Class.__super__.scanPass5.call(this);
        logging.debug("" + this.nodeType + ": Emitting RegPushImm(" + this.value + ")");
        return context.emitRegPushImm(this.value);
      };

      return _Class;

    })(ExpressionBase);
    module.PrimaryFloatExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(value) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        _Class.__super__.constructor.call(this, "PrimaryFloatExpression", "value");
        this.value = parseFloat(value);
      }

      _Class.prototype.scanPass4 = function() {
        _Class.__super__.scanPass4.call(this);
        return this.type = types.float;
      };

      _Class.prototype.scanPass5 = function(context) {
        _Class.__super__.scanPass5.call(this);
        return context.emitRegPushImm(this.value);
      };

      return _Class;

    })(ExpressionBase);
    module.PrimaryHackExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(expression) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        _Class.__super__.constructor.call(this, "PrimaryHackExpression", "value");
        this.expression = expression;
      }

      _Class.prototype.scanPass4 = function(context) {
        _Class.__super__.scanPass4.call(this, context);
        return this.expression.scanPass4(context);
      };

      _Class.prototype.scanPass5 = function(context) {
        var t;
        _Class.__super__.scanPass5.call(this);
        this.expression.scanPass5(context);
        logging.debug("" + this.nodeType + ": Emitting Gack, types:", (function() {
          var _i, _len, _ref, _results;
          _ref = this.expression.types;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            t = _ref[_i];
            _results.push(t.name);
          }
          return _results;
        }).call(this));
        return context.emitGack(this.expression.types);
      };

      return _Class;

    })(ExpressionBase);
    module.PrimaryStringExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(value) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        _Class.__super__.constructor.call(this, "PrimaryStringExpression", "value");
        this.value = value;
      }

      _Class.prototype.scanPass4 = function() {
        _Class.__super__.scanPass4.call(this);
        return this.type = types.String;
      };

      _Class.prototype.scanPass5 = function(context) {
        _Class.__super__.scanPass5.call(this);
        return context.emitRegPushImm(this.value);
      };

      return _Class;

    })(ExpressionBase);
    module.PrimaryArrayExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(base, indices) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        this.scanPass1 = __bind(this.scanPass1, this);
        _Class.__super__.constructor.call(this, "PrimaryArrayExpression", "variable");
        this.base = base;
        this.indices = indices;
      }

      _Class.prototype.scanPass1 = function() {
        _Class.__super__.scanPass1.call(this);
        this.base.scanPass1();
        return this.indices.scanPass1();
      };

      _Class.prototype.scanPass2 = function() {
        _Class.__super__.scanPass2.call(this);
        this.base.scanPass2();
        return this.indices.scanPass2();
      };

      _Class.prototype.scanPass3 = function() {
        _Class.__super__.scanPass3.call(this);
        this.base.scanPass3();
        return this.indices.scanPass3();
      };

      _Class.prototype.scanPass4 = function(context) {
        var baseType;
        _Class.__super__.scanPass4.call(this, context);
        logging.debug("" + this.nodeType + " scanPass4: Base");
        baseType = this.base.scanPass4(context);
        logging.debug("" + this.nodeType + " scanPass4: Indices");
        this.indices.scanPass4(context);
        logging.debug("" + this.nodeType + " scanPass4: Type determined to be " + baseType.name);
        return this.type = baseType;
      };

      _Class.prototype.scanPass5 = function(context) {
        logging.debug("" + this.nodeType + " emitting");
        _Class.__super__.scanPass5.call(this, context);
        this.base.scanPass5(context);
        this.indices.scanPass5(context);
        logging.debug("" + this.nodeType + ": Emitting ArrayAccess (as variable: " + this._emitVar + ")");
        return context.emitArrayAccess(this.type, this._emitVar);
      };

      return _Class;

    })(ExpressionBase);
    module.FuncCallExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(base, args) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        this.scanPass1 = __bind(this.scanPass1, this);
        _Class.__super__.constructor.call(this, "FuncCallExpression");
        this.func = base;
        this.args = args;
      }

      _Class.prototype.scanPass1 = function() {
        _Class.__super__.scanPass1.call(this);
        this.func.scanPass1();
        if (this.args != null) {
          return this.args.scanPass1();
        }
      };

      _Class.prototype.scanPass2 = function() {
        _Class.__super__.scanPass2.call(this);
        this.func.scanPass2();
        if (this.args != null) {
          return this.args.scanPass2();
        }
      };

      _Class.prototype.scanPass3 = function() {
        _Class.__super__.scanPass3.call(this);
        this.func.scanPass3();
        if (this.args != null) {
          return this.args.scanPass3();
        }
      };

      _Class.prototype.scanPass4 = function(context) {
        var funcGroup;
        _Class.__super__.scanPass4.call(this, context);
        logging.debug("" + this.nodeType + " scanPass4: Checking type of @func");
        this.func.scanPass4(context);
        if (this.args != null) {
          this.args.scanPass4(context);
        }
        funcGroup = this.func.value.value;
        this._ckFunc = funcGroup.findOverload(this.args._expressions);
        this.type = funcGroup.retType;
        logging.debug("" + this.nodeType + " scanPass4: Got function overload " + this._ckFunc.name + " with return type " + this.type.name);
        return this.type;
      };

      _Class.prototype.scanPass5 = function(context) {
        _Class.__super__.scanPass5.call(this, context);
        if (this.args != null) {
          logging.debug("" + this.nodeType + ": Emitting arguments");
          this.args.scanPass5(context);
        }
        logging.debug("" + this.nodeType + ": Emitting function " + this._ckFunc.name);
        context.emitDotStaticFunc(this._ckFunc);
        context.emitRegPushImm(0);
        if (this._ckFunc.isMember) {
          logging.debug("" + this.nodeType + ": Emitting instance method call");
          return context.emitFuncCallMember();
        } else {
          logging.debug("" + this.nodeType + ": Emitting static method call");
          return context.emitFuncCallStatic();
        }
      };

      return _Class;

    })(ExpressionBase);
    module.DurExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(base, unit) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        _Class.__super__.constructor.call(this, "DurExpression");
        this.base = base;
        this.unit = unit;
      }

      _Class.prototype.scanPass2 = function() {
        _Class.__super__.scanPass2.call(this);
        logging.debug('DurExpression');
        this.base.scanPass2();
        return this.unit.scanPass2();
      };

      _Class.prototype.scanPass3 = function() {
        _Class.__super__.scanPass3.call(this);
        this.base.scanPass3();
        return this.unit.scanPass3();
      };

      _Class.prototype.scanPass4 = function() {
        _Class.__super__.scanPass4.call(this);
        this.type = types.Dur;
        this.base.scanPass4();
        return this.unit.scanPass4();
      };

      _Class.prototype.scanPass5 = function(context) {
        _Class.__super__.scanPass5.call(this);
        this.base.scanPass5(context);
        this.unit.scanPass5(context);
        return context.emitTimesNumber();
      };

      return _Class;

    })(ExpressionBase);
    module.UnaryExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(operator, exp) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.op = operator;
        this.exp = exp;
      }

      _Class.prototype.scanPass4 = function(context) {
        if (this.exp != null) {
          this.exp.scanPass4(context);
        }
        return this.type = this.op.check(this.exp);
      };

      _Class.prototype.scanPass5 = function(context) {
        logging.debug("UnaryExpression: Emitting expression");
        this.exp.scanPass5(context);
        logging.debug("UnaryExpression: Emitting operator");
        this.op.emit(context);
      };

      return _Class;

    })(ExpressionBase);
    module.ChuckOperator = (function() {
      function _Class() {
        this.emit = __bind(this.emit, this);
        this.check = __bind(this.check, this);
        this.name = "ChuckOperator";
      }

      _Class.prototype.check = function(lhs, rhs, context) {
        var funcGroup;
        if (lhs.type === rhs.type) {
          if (typesModule.isPrimitive(lhs.type) || lhs.type === types.String) {
            if (rhs._meta === "variable") {
              rhs._emitVar = true;
            }
            return rhs.type;
          }
        }
        if (lhs.type === types.Dur && rhs.type === types.Time && rhs.name === "now") {
          return rhs.type;
        }
        if (lhs.type.isOfType(types.UGen) && rhs.type.isOfType(types.UGen)) {
          return rhs.type;
        }
        if (rhs.type.isOfType(types.Function)) {
          rhs.scanPass4(context);
          funcGroup = rhs.value.value;
          rhs._ckFunc = funcGroup.findOverload([lhs]);
          this.type = funcGroup.retType;
          logging.debug("" + this.name + " check: Got function overload " + rhs._ckFunc.name + " with return type " + this.type.name);
          return this.type;
        }
      };

      _Class.prototype.emit = function(context, lhs, rhs) {
        var isArray;
        if (lhs.type.isOfType(types.UGen) && rhs.type.isOfType(types.UGen)) {
          context.emitUGenLink();
        } else if (lhs.type.isOfType(types.Dur) && rhs.type.isOfType(types.Time)) {
          context.emitAddNumber();
          if (rhs.name === "now") {
            context.emitTimeAdvance();
          }
        } else if (rhs.type.isOfType(types.Function)) {
          context.emitRegPushImm(8);
          context.emitFuncCallMember();
        } else if (lhs.type.isOfType(rhs.type)) {
          isArray = rhs.indices != null;
          if (!isArray) {
            logging.debug("ChuckOperator emitting OpAtChuck to assign one object to another");
          } else {
            logging.debug("ChuckOperator emitting OpAtChuck to assign an object to an array element");
          }
          return context.emitOpAtChuck(isArray);
        }
      };

      return _Class;

    })();
    module.UnchuckOperator = (function() {
      function _Class() {
        this.emit = __bind(this.emit, this);
        this.check = __bind(this.check, this);
        this.name = "UnchuckOperator";
      }

      _Class.prototype.check = function(lhs, rhs, context) {
        if (lhs.type.isOfType(types.UGen) && rhs.type.isOfType(types.UGen)) {
          return rhs.type;
        }
      };

      _Class.prototype.emit = function(context, lhs, rhs) {
        if (lhs.type.isOfType(types.UGen) && rhs.type.isOfType(types.UGen)) {
          context.emitUGenUnlink();
        }
      };

      return _Class;

    })();
    AdditiveSubtractiveOperatorBase = (function() {
      function AdditiveSubtractiveOperatorBase() {
        this.check = __bind(this.check, this);
      }

      AdditiveSubtractiveOperatorBase.prototype.check = function(lhs, rhs) {
        if ((lhs.type === types.Dur && rhs.type === types.Time) || (lhs.type === types.Time && rhs.type === types.Dur)) {
          return types.Time;
        }
        if (lhs.type === types.int && rhs.type === types.int) {
          return types.int;
        }
        if ((lhs.type === types.float && rhs.type === types.float) || (lhs.type === types.int && rhs.type === types.float) || (lhs.type === types.float && rhs.type === types.int)) {
          return types.float;
        }
      };

      return AdditiveSubtractiveOperatorBase;

    })();
    module.PlusOperator = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        this.emit = __bind(this.emit, this);
        this.name = "PlusOperator";
      }

      _Class.prototype.emit = function(context, lhs, rhs) {
        logging.debug('PlusOperator emitting AddNumber');
        return context.emitAddNumber();
      };

      return _Class;

    })(AdditiveSubtractiveOperatorBase);
    PlusPlusOperatorBase = (function() {
      function _Class(name) {
        this.check = __bind(this.check, this);
        this.name = name;
      }

      _Class.prototype.check = function(exp) {
        var type;
        exp._emitVar = true;
        type = exp.type;
        if (type === types.int || type === types.float) {
          return type;
        } else {
          return null;
        }
      };

      return _Class;

    })();
    module.PrefixPlusPlusOperator = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        this.emit = __bind(this.emit, this);
        _Class.__super__.constructor.call(this, "PrefixPlusPlusOperator");
      }

      _Class.prototype.emit = function(context) {
        logging.debug("" + this.name + " emitting PreIncNumber");
        return context.emitPreIncNumber();
      };

      return _Class;

    })(PlusPlusOperatorBase);
    module.PostfixPlusPlusOperator = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        this.emit = __bind(this.emit, this);
        _Class.__super__.constructor.call(this, "PostfixPlusPlusOperator");
      }

      _Class.prototype.emit = function(context) {
        logging.debug("" + this.name + " emitting PostIncNumber");
        return context.emitPostIncNumber();
      };

      return _Class;

    })(PlusPlusOperatorBase);
    module.MinusOperator = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        this.emit = __bind(this.emit, this);
        this.name = "MinusOperator";
      }

      _Class.prototype.emit = function(context, lhs, rhs) {
        logging.debug('MinusOperator emitting SubtractNumber');
        return context.emitSubtractNumber();
      };

      return _Class;

    })(AdditiveSubtractiveOperatorBase);
    module.MinusMinusOperator = (function() {
      function _Class() {
        this.name = "MinusMinusOperator";
      }

      return _Class;

    })();
    module.TimesOperator = TimesOperator = (function() {
      function TimesOperator() {
        this.emit = __bind(this.emit, this);
        this.check = __bind(this.check, this);
        this.name = "TimesOperator";
      }

      TimesOperator.prototype.check = function(lhs, rhs, context) {
        if (lhs.type === types.float && rhs.type === types.float) {
          return types.float;
        }
      };

      TimesOperator.prototype.emit = function(context) {
        return context.emitTimesNumber();
      };

      return TimesOperator;

    })();
    GtLtOperatorBase = (function() {
      function GtLtOperatorBase() {
        this.check = __bind(this.check, this);
      }

      GtLtOperatorBase.prototype.check = function(lhs, rhs) {
        if (lhs.type === rhs.type) {
          return lhs.type;
        }
        if (lhs.type === types.Time && rhs.type === types.Time) {
          return types.int;
        }
      };

      return GtLtOperatorBase;

    })();
    module.LtOperator = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        this.emit = __bind(this.emit, this);
        this.name = "LtOperator";
      }

      _Class.prototype.emit = function(context) {
        logging.debug("LtOperator: Emitting");
        return context.emitLtNumber();
      };

      return _Class;

    })(GtLtOperatorBase);
    module.GtOperator = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        this.emit = __bind(this.emit, this);
        this.name = "GtOperator";
      }

      _Class.prototype.emit = function(context) {
        logging.debug("GtOperator: Emitting");
        return context.emitGtNumber();
      };

      return _Class;

    })(GtLtOperatorBase);
    module.WhileStatement = (function(_super) {
      __extends(_Class, _super);

      function _Class(cond, body) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        this.scanPass1 = __bind(this.scanPass1, this);
        _Class.__super__.constructor.call(this, "WhileStatement");
        this.condition = cond;
        this.body = body;
      }

      _Class.prototype.scanPass1 = function() {
        this.condition.scanPass1();
        this.body.scanPass1();
      };

      _Class.prototype.scanPass2 = function() {
        this.condition.scanPass2();
        this.body.scanPass2();
      };

      _Class.prototype.scanPass3 = function(context) {
        this.condition.scanPass3(context);
        this.body.scanPass3(context);
      };

      _Class.prototype.scanPass4 = function(context) {
        logging.debug("WhileStatement: Type checking condition");
        this.condition.scanPass4(context);
        logging.debug("WhileStatement: Body");
        this.body.scanPass4(context);
      };

      _Class.prototype.scanPass5 = function(context) {
        var branchEq, breakJmp, startIndex;
        startIndex = context.getNextIndex();
        this.condition.scanPass5(context);
        context.emitRegPushImm(false);
        logging.debug("WhileStatement: Emitting BranchEq");
        branchEq = context.emitBranchEq();
        this.body.scanPass5(context);
        logging.debug("WhileStatement: Emitting GoTo (instruction number " + startIndex + ")");
        context.emitGoto(startIndex);
        context.evaluateBreaks();
        breakJmp = context.getNextIndex();
        logging.debug("WhileStatement: Configuring BranchEq instruction to jump to instruction number " + breakJmp);
        branchEq.jmp = breakJmp;
      };

      return _Class;

    })(NodeBase);
    module.ForStatement = (function(_super) {
      __extends(_Class, _super);

      function _Class(c1, c2, c3, body) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        _Class.__super__.constructor.call(this, "ForStatement");
        this.c1 = c1;
        this.c2 = c2;
        this.c3 = c3;
        this.body = body;
      }

      _Class.prototype.scanPass2 = function(context) {
        this.c1.scanPass2(context);
        this.c2.scanPass2(context);
        if (this.c3 != null) {
          this.c3.scanPass2(context);
        }
        this.body.scanPass2(context);
      };

      _Class.prototype.scanPass3 = function(context) {
        logging.debug("" + this.nodeType);
        context.enterScope();
        this.c1.scanPass3(context);
        this.c2.scanPass3(context);
        if (this.c3 != null) {
          this.c3.scanPass3(context);
        }
        this.body.scanPass3(context);
        context.exitScope();
      };

      _Class.prototype.scanPass4 = function(context) {
        logging.debug("" + this.nodeType);
        context.enterScope();
        logging.debug("" + this.nodeType + ": Checking the initial");
        this.c1.scanPass4(context);
        logging.debug("" + this.nodeType + ": Checking the condition");
        this.c2.scanPass4(context);
        if (this.c3 != null) {
          logging.debug("" + this.nodeType + ": Checking the post");
          this.c3.scanPass4(context);
        }
        logging.debug("" + this.nodeType + ": Checking the body");
        this.body.scanPass4(context);
        context.exitScope();
      };

      _Class.prototype.scanPass5 = function(context) {
        var branchEq, breakJmp, startIndex;
        context.emitScopeEntrance();
        logging.debug("" + this.nodeType + ": Emitting the initial");
        this.c1.scanPass5(context);
        startIndex = context.getNextIndex();
        logging.debug("" + this.nodeType + ": Emitting the condition");
        this.c2.scanPass5(context, {
          pop: false
        });
        context.emitRegPushImm(false);
        logging.debug("" + this.nodeType + ": Emitting BranchEq");
        branchEq = context.emitBranchEq();
        context.emitScopeEntrance();
        logging.debug("" + this.nodeType + ": Emitting the body");
        this.body.scanPass5(context);
        context.emitScopeExit();
        if (this.c3 != null) {
          logging.debug("" + this.nodeType + ": Emitting the post");
          this.c3.scanPass5(context);
          context.emitPopWord();
        }
        logging.debug("ForStatement: Emitting GoTo (instruction number " + startIndex + ")");
        context.emitGoto(startIndex);
        if (this.c2 != null) {
          breakJmp = context.getNextIndex();
          logging.debug("ForStatement: Configuring BranchEq instruction to jump to instruction number " + breakJmp);
          branchEq.jmp = breakJmp;
        }
        context.evaluateBreaks();
        context.emitScopeExit();
      };

      return _Class;

    })(NodeBase);
    module.CodeStatement = (function(_super) {
      __extends(_Class, _super);

      function _Class(statementList) {
        _Class.__super__.constructor.call(this, statementList, "CodeStatement");
      }

      return _Class;

    })(ParentNodeBase);
    module.BreakStatement = (function(_super) {
      __extends(_Class, _super);

      function _Class() {
        _Class.__super__.constructor.call(this, 'BreakStatement');
      }

      _Class.prototype.scanPass5 = function(context) {
        context.emitBreak();
      };

      return _Class;

    })(NodeBase);
    module.DotMemberExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(base, id) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        this.scanPass3 = __bind(this.scanPass3, this);
        this.scanPass2 = __bind(this.scanPass2, this);
        _Class.__super__.constructor.call(this, "DotMemberExpression");
        this.base = base;
        this.id = id;
      }

      _Class.prototype.scanPass2 = function() {
        this.base.scanPass2();
      };

      _Class.prototype.scanPass3 = function() {
        this.base.scanPass3();
      };

      _Class.prototype.scanPass4 = function(context) {
        var baseStatic, baseType;
        logging.debug("" + this.nodeType + " scanPass4");
        this.base.scanPass4(context);
        baseStatic = this.base.type.actualType != null;
        if (baseStatic) {
          logging.debug("" + this.nodeType + " scanPass4: This is a static member expression");
        }
        baseType = baseStatic ? this.base.type.actualType : this.base.type;
        logging.debug("" + this.nodeType + " scanPass4: Finding member '" + this.id + "' in base type " + baseType.name);
        this.value = baseType.findValue(this.id);
        this.type = this.value.type;
        logging.debug("" + this.nodeType + " scanPass4: Member type is " + this.type.name);
        return this.type;
      };

      _Class.prototype.scanPass5 = function(context) {
        this.base.scanPass5(context);
        context.emitRegDupLast();
        context.emitDotMemberFunc(this._ckFunc);
      };

      return _Class;

    })(NodeBase);
    module.PostfixExpression = (function(_super) {
      __extends(_Class, _super);

      function _Class(base, operator) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        _Class.__super__.constructor.call(this, "PostfixExpression", "variable");
        this.exp = base;
        this.op = operator;
      }

      _Class.prototype.scanPass4 = function(context) {
        this.exp.scanPass4(context);
        return this.type = this.op.check(this.exp);
      };

      _Class.prototype.scanPass5 = function(context) {
        this.exp.scanPass5(context);
        return this.op.emit(context);
      };

      return _Class;

    })(NodeBase);
    module.ArraySub = (function(_super) {
      __extends(_Class, _super);

      function _Class(exp) {
        this.scanPass5 = __bind(this.scanPass5, this);
        this.scanPass4 = __bind(this.scanPass4, this);
        _Class.__super__.constructor.call(this, "ArraySub");
        this.exp = exp;
      }

      _Class.prototype.scanPass4 = function(context) {
        logging.debug("" + this.nodeType + " scanPass4");
        return this.exp.scanPass4(context);
      };

      _Class.prototype.scanPass5 = function(context) {
        logging.debug("" + this.nodeType + ": Emitting array indices");
        return this.exp.scanPass5(context);
      };

      return _Class;

    })(NodeBase);
    return module;
  });

}).call(this);

(function() {
  define("chuck/parserService", ["chuck/lexer", "chuck/nodes", "chuck/logging"], function(lexer, nodes, logging) {
    var yy;
    yy = _({}).extend(nodes);
    yy.addLocationDataFn = function(first, last) {
      return function(obj) {
        return obj;
      };
    };
    return {
      parse: function(sourceCode) {
        var parser, tokens;
        parser = new ChuckParser();
        parser.yy = yy;
        parser.lexer = {
          lex: function() {
            var tag, token;
            token = this.tokens[this.pos++];
            if (token) {
              tag = token[0], this.yytext = token[1], this.yylloc = token[2];
              this.yylineno = this.yylloc.first_line;
            } else {
              tag = '';
            }
            return tag;
          },
          setInput: function(tokens) {
            this.tokens = tokens;
            return this.pos = 0;
          },
          upcomingInput: function() {
            return "";
          }
        };
        tokens = lexer.tokenize(sourceCode);
        logging.debug("Parsing tokens:", tokens);
        return parser.parse(tokens);
      }
    };
  });

}).call(this);

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
        this._tick = type.ugenTick != null ? _(type.ugenTick).bind(this) : function(input) {
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

(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  define("chuck/instructions", ["chuck/ugen", "chuck/logging", "chuck/types"], function(ugen, logging, typesModule) {
    var Instruction, UnaryOpInstruction, callMethod, module, types;
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
        _(this).extend(params);
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
        var obj;
        obj = vm.popFromReg();
        logging.debug("DotMemberFunc: Pushing method " + func.name + " of type " + obj.type.name + " to stack");
        vm.pushToReg(func);
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
    module.regPushNow = function() {
      return new Instruction("RegPushNow", {}, function(vm) {
        vm.pushNow();
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
      return new Instruction("TimesNUmber", {}, function(vm) {
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
    module.gack = function(types) {
      return new Instruction("Gack", {}, function(vm) {
        module.hack(types[0]).execute(vm);
      });
    };
    module.hack = function(type) {
      return new Instruction("Hack", {}, function(vm) {
        var obj;
        obj = vm.peekReg();
        logging.debug("Printing object of type " + type.name + ":", obj);
        if (type === types.String) {
          console.log("\"" + obj + "\" : (" + type.name + ")");
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

(function() {
  define("chuck/libs/math", ["chuck/types"], function(typesModule) {
    var ChuckStaticMethod, ChuckType, FunctionArg, FunctionOverload, Object, float, mathNamespace, module, types, _ref;
    ChuckType = typesModule.ChuckType, ChuckStaticMethod = typesModule.ChuckStaticMethod, FunctionArg = typesModule.FunctionArg, FunctionOverload = typesModule.FunctionOverload;
    _ref = typesModule.types, Object = _ref.Object, float = _ref.float;
    module = {};
    types = module.types = {};
    mathNamespace = {
      pow: new ChuckStaticMethod("pow", [
        new FunctionOverload([new FunctionArg("x", float), new FunctionArg("y", float)], function(x, y) {
          return Math.pow(x, y);
        })
      ], "Math", float)
    };
    types.Math = new ChuckType("Math", Object, {
      namespace: mathNamespace
    });
    return module;
  });

}).call(this);

(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty;

  define("chuck/scanner", ["chuck/nodes", "chuck/types", "chuck/instructions", "chuck/namespace", "chuck/logging", "chuck/libs/math"], function(nodes, types, instructions, namespaceModule, logging, mathLib) {
    var ChuckCode, ChuckFrame, ChuckLocal, Scanner, ScanningContext, module;
    module = {};
    ChuckLocal = (function() {
      function ChuckLocal(size, offset, name) {
        this.size = size;
        this.offset = offset;
        this.name = name;
      }

      return ChuckLocal;

    })();
    ChuckFrame = (function() {
      function ChuckFrame() {
        this.currentOffset = 0;
        this.stack = [];
      }

      return ChuckFrame;

    })();
    ChuckCode = (function() {
      function ChuckCode() {
        this.getNextIndex = __bind(this.getNextIndex, this);
        this.finish = __bind(this.finish, this);
        this.allocateLocal = __bind(this.allocateLocal, this);
        this.append = __bind(this.append, this);
        this.popScope = __bind(this.popScope, this);
        this.pushScope = __bind(this.pushScope, this);
        this.instructions = [];
        this.frame = new ChuckFrame();
        this.pushScope();
      }

      ChuckCode.prototype.pushScope = function() {
        this.frame.stack.push(null);
      };

      ChuckCode.prototype.popScope = function() {
        while (this.frame.stack.length > 0 && (this.frame.stack[this.frame.stack.length - 1] != null)) {
          this.frame.stack.pop();
          --this.frame.currentOffset;
        }
        this.frame.stack.pop();
        logging.debug("After popping scope, current stack offset is " + this.frame.currentOffset);
      };

      ChuckCode.prototype.append = function(instruction) {
        this.instructions.push(instruction);
        return instruction;
      };

      ChuckCode.prototype.allocateLocal = function(type, value) {
        var local;
        local = new ChuckLocal(type.size, this.frame.currentOffset, value.name);
        logging.debug("Allocating local " + value.name + " of type " + type.name + " at offset " + local.offset);
        this.frame.currentOffset += 1;
        this.frame.stack.push(local);
        value.offset = local.offset;
        return local;
      };

      ChuckCode.prototype.finish = function() {
        var local, locals, stack;
        stack = this.frame.stack;
        locals = [];
        while (stack.length > 0 && (stack[stack.length - 1] != null)) {
          local = stack.pop();
          if (local != null) {
            this.frame.currentOffset -= local.size;
            locals.push(local);
          }
        }
        stack.pop();
        return locals;
      };

      ChuckCode.prototype.getNextIndex = function() {
        return this.instructions.length;
      };

      return ChuckCode;

    })();
    ScanningContext = (function() {
      function ScanningContext() {
        this._nextIndex = __bind(this._nextIndex, this);
        this._emitPreConstructor = __bind(this._emitPreConstructor, this);
        this.finishScanning = __bind(this.finishScanning, this);
        this.evaluateBreaks = __bind(this.evaluateBreaks, this);
        this.emitArrayAccess = __bind(this.emitArrayAccess, this);
        this.emitBreak = __bind(this.emitBreak, this);
        this.emitGoto = __bind(this.emitGoto, this);
        this.emitBranchEq = __bind(this.emitBranchEq, this);
        this.emitGack = __bind(this.emitGack, this);
        this.emitOpAtChuck = __bind(this.emitOpAtChuck, this);
        this.emitTimeAdvance = __bind(this.emitTimeAdvance, this);
        this.emitGtNumber = __bind(this.emitGtNumber, this);
        this.emitLtNumber = __bind(this.emitLtNumber, this);
        this.emitTimesNumber = __bind(this.emitTimesNumber, this);
        this.emitSubtractNumber = __bind(this.emitSubtractNumber, this);
        this.emitPostIncNumber = __bind(this.emitPostIncNumber, this);
        this.emitPreIncNumber = __bind(this.emitPreIncNumber, this);
        this.emitAddNumber = __bind(this.emitAddNumber, this);
        this.emitRegPushNow = __bind(this.emitRegPushNow, this);
        this.emitTimesNumber = __bind(this.emitTimesNumber, this);
        this.emitDotStaticFunc = __bind(this.emitDotStaticFunc, this);
        this.emitDotMemberFunc = __bind(this.emitDotMemberFunc, this);
        this.emitRegDupLast = __bind(this.emitRegDupLast, this);
        this.emitRegPushMem = __bind(this.emitRegPushMem, this);
        this.emitRegPushMemAddr = __bind(this.emitRegPushMemAddr, this);
        this.emitFuncCallStatic = __bind(this.emitFuncCallStatic, this);
        this.emitFuncCallMember = __bind(this.emitFuncCallMember, this);
        this.emitRegPushImm = __bind(this.emitRegPushImm, this);
        this.emitPopWord = __bind(this.emitPopWord, this);
        this.emitUGenUnlink = __bind(this.emitUGenUnlink, this);
        this.emitUGenLink = __bind(this.emitUGenLink, this);
        this.emitDac = __bind(this.emitDac, this);
        this.emitAssignment = __bind(this.emitAssignment, this);
        this.emitScopeExit = __bind(this.emitScopeExit, this);
        this.emitScopeEntrance = __bind(this.emitScopeEntrance, this);
        this.exitScope = __bind(this.exitScope, this);
        this.enterScope = __bind(this.enterScope, this);
        this.getNextIndex = __bind(this.getNextIndex, this);
        this.allocateLocal = __bind(this.allocateLocal, this);
        this.instantiateObject = __bind(this.instantiateObject, this);
        this.pushToContStack = __bind(this.pushToContStack, this);
        this.pushToBreakStack = __bind(this.pushToBreakStack, this);
        this.addValue = __bind(this.addValue, this);
        this.addVariable = __bind(this.addVariable, this);
        this.findValue = __bind(this.findValue, this);
        this.findType = __bind(this.findType, this);
        var k, lib, type, typeType, _i, _len, _ref, _ref1;
        this.code = new ChuckCode();
        this._globalNamespace = new namespaceModule.Namespace("global");
        _ref = [types, mathLib];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          lib = _ref[_i];
          _ref1 = lib.types;
          for (k in _ref1) {
            if (!__hasProp.call(_ref1, k)) continue;
            type = _ref1[k];
            this._globalNamespace.addType(type);
            typeType = _.extend({}, types.Class);
            typeType.actualType = type;
            this._globalNamespace.addVariable(type.name, typeType, type);
          }
        }
        this._globalNamespace.commit();
        this._namespaceStack = [this._globalNamespace];
        this._currentNamespace = this._globalNamespace;
        this._breakStack = [];
        this._contStack = [];
      }

      ScanningContext.prototype.findType = function(typeName) {
        var type;
        type = this._currentNamespace.findType(typeName);
        return type;
      };

      ScanningContext.prototype.findValue = function(name, climb) {
        var val;
        if (climb == null) {
          climb = false;
        }
        val = this._currentNamespace.findValue(name, climb);
        if (val != null) {
          return val;
        }
        return val = this._currentNamespace.findValue(name, true);
      };

      ScanningContext.prototype.addVariable = function(name, typeName) {
        return this._currentNamespace.addVariable(name, typeName);
      };

      ScanningContext.prototype.addValue = function(value) {
        return this._currentNamespace.addValue(value);
      };

      ScanningContext.prototype.pushToBreakStack = function(statement) {
        return this._breakStack.push(statement);
      };

      ScanningContext.prototype.pushToContStack = function(statement) {
        return this._contStack.push(statement);
      };

      ScanningContext.prototype.instantiateObject = function(type) {
        logging.debug("Emitting instantiation of object of type " + type.name + " along with preconstructor");
        this.code.append(instructions.instantiateObject(type));
        return this._emitPreConstructor(type);
      };

      ScanningContext.prototype.allocateLocal = function(type, value) {
        var local;
        logging.debug("Allocating local");
        logging.debug("Emitting AllocWord instruction");
        local = this.code.allocateLocal(type, value);
        return this.code.append(instructions.allocWord(local.offset));
      };

      ScanningContext.prototype.getNextIndex = function() {
        return this.code.getNextIndex();
      };

      ScanningContext.prototype.enterScope = function() {
        return this._currentNamespace.enterScope();
      };

      ScanningContext.prototype.exitScope = function() {
        return this._currentNamespace.exitScope();
      };

      ScanningContext.prototype.emitScopeEntrance = function() {
        logging.debug("Emitting entrance of nested scope");
        this.code.pushScope();
      };

      ScanningContext.prototype.emitScopeExit = function() {
        logging.debug("Emitting exit of nested scope");
        this.code.popScope();
      };

      ScanningContext.prototype.emitAssignment = function(type, varDecl) {
        var array, bottom, isObj, startIndex, top, value;
        value = varDecl.value, array = varDecl.array;
        if (array != null) {
          logging.debug("Emitting array indices");
          array.scanPass5(this);
          logging.debug("Emitting AllocateArray");
          this.code.append(instructions.allocateArray(type));
          if (types.isObj(type)) {
            startIndex = this._nextIndex();
            logging.debug("Emitting PreCtorArrayTop");
            top = this.code.append(instructions.preCtorArrayTop(type));
            this._emitPreConstructor(type);
            logging.debug("Emitting PreCtorArrayBottom");
            bottom = this.code.append(instructions.preCtorArrayBottom(type));
            top.set(this._nextIndex());
            bottom.set(startIndex);
            this.code.append(instructions.preCtorArrayPost());
          }
        }
        isObj = types.isObj(type) || (array != null);
        if (isObj && (array == null)) {
          this.instantiateObject(type);
        }
        this.allocateLocal(type, value);
        if (isObj) {
          logging.debug("Emitting AssignObject");
          this.code.append(instructions.assignObject());
        }
      };

      ScanningContext.prototype.emitDac = function() {
        this.code.append(instructions.dac());
      };

      ScanningContext.prototype.emitUGenLink = function() {
        this.code.append(instructions.uGenLink());
      };

      ScanningContext.prototype.emitUGenUnlink = function() {
        this.code.append(instructions.uGenUnlink());
      };

      ScanningContext.prototype.emitPopWord = function() {
        this.code.append(instructions.popWord());
      };

      ScanningContext.prototype.emitRegPushImm = function(value) {
        this.code.append(instructions.regPushImm(value));
      };

      ScanningContext.prototype.emitFuncCallMember = function() {
        this.code.append(instructions.funcCallMember());
      };

      ScanningContext.prototype.emitFuncCallStatic = function() {
        this.code.append(instructions.funcCallStatic());
      };

      ScanningContext.prototype.emitRegPushMemAddr = function(offset) {
        this.code.append(instructions.regPushMemAddr(offset));
      };

      ScanningContext.prototype.emitRegPushMem = function(offset) {
        this.code.append(instructions.regPushMem(offset));
      };

      ScanningContext.prototype.emitRegDupLast = function() {
        this.code.append(instructions.regDupLast());
      };

      ScanningContext.prototype.emitDotMemberFunc = function(func) {
        this.code.append(instructions.dotMemberFunc(func));
      };

      ScanningContext.prototype.emitDotStaticFunc = function(func) {
        this.code.append(instructions.dotStaticFunc(func));
      };

      ScanningContext.prototype.emitTimesNumber = function() {
        this.code.append(instructions.timesNumber());
      };

      ScanningContext.prototype.emitRegPushNow = function() {
        this.code.append(instructions.regPushNow());
      };

      ScanningContext.prototype.emitAddNumber = function() {
        this.code.append(instructions.addNumber());
      };

      ScanningContext.prototype.emitPreIncNumber = function() {
        return this.code.append(instructions.preIncNumber());
      };

      ScanningContext.prototype.emitPostIncNumber = function() {
        return this.code.append(instructions.postIncNumber());
      };

      ScanningContext.prototype.emitSubtractNumber = function() {
        this.code.append(instructions.subtractNumber());
      };

      ScanningContext.prototype.emitTimesNumber = function() {
        return this.code.append(instructions.timesNumber());
      };

      ScanningContext.prototype.emitLtNumber = function() {
        this.code.append(instructions.ltNumber());
      };

      ScanningContext.prototype.emitGtNumber = function() {
        this.code.append(instructions.gtNumber());
      };

      ScanningContext.prototype.emitTimeAdvance = function() {
        this.code.append(instructions.timeAdvance());
      };

      ScanningContext.prototype.emitOpAtChuck = function(isArray) {
        logging.debug("Emitting AssignObject (isArray: " + isArray + ")");
        this.code.append(instructions.assignObject(isArray));
      };

      ScanningContext.prototype.emitGack = function(types) {
        this.code.append(instructions.gack(types));
      };

      ScanningContext.prototype.emitBranchEq = function(jmp) {
        return this.code.append(instructions.branchEq(jmp));
      };

      ScanningContext.prototype.emitGoto = function(jmp) {
        return this.code.append(instructions.goto(jmp));
      };

      ScanningContext.prototype.emitBreak = function() {
        var instr;
        instr = instructions.goto();
        this.code.append(instr);
        return this._breakStack.push(instr);
      };

      ScanningContext.prototype.emitArrayAccess = function(type, emitAddr) {
        return this.code.append(instructions.arrayAccess(type, emitAddr));
      };

      ScanningContext.prototype.evaluateBreaks = function() {
        var instr;
        while (this._breakStack.length) {
          instr = this._breakStack.pop();
          instr.jmp = this._nextIndex();
        }
      };

      ScanningContext.prototype.finishScanning = function() {
        var local, locals, _i, _len;
        locals = this.code.finish();
        for (_i = 0, _len = locals.length; _i < _len; _i++) {
          local = locals[_i];
          this.code.append(instructions.releaseObject2(local.offset));
        }
        this.code.append(instructions.eoc());
      };

      ScanningContext.prototype._emitPreConstructor = function(type) {
        if (type.parent != null) {
          this._emitPreConstructor(type.parent);
        }
        if (type.hasConstructor) {
          this.code.append(instructions.preConstructor(type, this.code.frame.currentOffset));
        }
      };

      ScanningContext.prototype._nextIndex = function() {
        return this.code.instructions.length;
      };

      return ScanningContext;

    })();
    Scanner = (function() {
      function Scanner(ast) {
        this._pass = __bind(this._pass, this);
        this.pass5 = __bind(this.pass5, this);
        this.pass4 = __bind(this.pass4, this);
        this.pass3 = __bind(this.pass3, this);
        this.pass2 = __bind(this.pass2, this);
        this.pass1 = __bind(this.pass1, this);
        this._ast = ast;
        this._context = new ScanningContext();
      }

      Scanner.prototype.pass1 = function() {
        return this._pass(1);
      };

      Scanner.prototype.pass2 = function() {
        return this._pass(2);
      };

      Scanner.prototype.pass3 = function() {
        return this._pass(3);
      };

      Scanner.prototype.pass4 = function() {
        return this._pass(4);
      };

      Scanner.prototype.pass5 = function() {
        this._pass(5);
        this._context.finishScanning();
        return this.byteCode = this._context.code.instructions;
      };

      Scanner.prototype._pass = function(num) {
        var program;
        program = this._ast;
        return program["scanPass" + num](this._context);
      };

      return Scanner;

    })();
    module.scan = function(ast) {
      var scanner;
      scanner = new Scanner(ast);
      logging.debug("Scan pass 1");
      scanner.pass1();
      logging.debug("Scan pass 2");
      scanner.pass2();
      logging.debug("Scan pass 3");
      scanner.pass3();
      logging.debug("Scan pass 4");
      scanner.pass4();
      logging.debug("Scan pass 5");
      scanner.pass5();
      return scanner.byteCode;
    };
    return module;
  });

}).call(this);

(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  define("chuck/vm", ["chuck/logging", "chuck/ugen", "chuck/types", "chuck/audioContextService"], function(logging, ugen, types, audioContextService) {
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
        deferred = Q.defer();
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
        this._vm.stop();
        return audioContextService.stopOperation();
      };

      _Class.prototype.isExecuting = function() {
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

//     Underscore.js 1.5.2
//     http://underscorejs.org
//     (c) 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    concat           = ArrayProto.concat,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.5.2';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, length = obj.length; i < length; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      var keys = _.keys(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
      }
    }
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results.push(iterator.call(context, value, index, list));
    });
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var length = obj.length;
    if (length !== +length) {
      var keys = _.keys(obj);
      length = keys.length;
    }
    each(obj, function(value, index, list) {
      index = keys ? keys[--length] : --length;
      if (!initial) {
        memo = obj[index];
        initial = true;
      } else {
        memo = iterator.call(context, memo, obj[index], index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, iterator, context) {
    var result;
    any(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    each(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, iterator, context) {
    return _.filter(obj, function(value, index, list) {
      return !iterator.call(context, value, index, list);
    }, context);
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
    each(obj, function(value, index, list) {
      if (!(result = result && iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
    each(obj, function(value, index, list) {
      if (result || (result = iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    return any(obj, function(value) {
      return value === target;
    });
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, function(value){ return value[key]; });
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs, first) {
    if (_.isEmpty(attrs)) return first ? void 0 : [];
    return _[first ? 'find' : 'filter'](obj, function(value) {
      for (var key in attrs) {
        if (attrs[key] !== value[key]) return false;
      }
      return true;
    });
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.where(obj, attrs, true);
  };

  // Return the maximum element or (element-based computation).
  // Can't optimize arrays of integers longer than 65,535 elements.
  // See [WebKit Bug 80797](https://bugs.webkit.org/show_bug.cgi?id=80797)
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.max.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return -Infinity;
    var result = {computed : -Infinity, value: -Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed > result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.min.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return Infinity;
    var result = {computed : Infinity, value: Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed < result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Shuffle an array, using the modern version of the 
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var rand;
    var index = 0;
    var shuffled = [];
    each(obj, function(value) {
      rand = _.random(index++);
      shuffled[index - 1] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // Sample **n** random values from an array.
  // If **n** is not specified, returns a single random element from the array.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (arguments.length < 2 || guard) {
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // An internal function to generate lookup iterators.
  var lookupIterator = function(value) {
    return _.isFunction(value) ? value : function(obj){ return obj[value]; };
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, value, context) {
    var iterator = lookupIterator(value);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, value, context) {
      var result = {};
      var iterator = value == null ? _.identity : lookupIterator(value);
      each(obj, function(value, index) {
        var key = iterator.call(context, value, index, obj);
        behavior(result, key, value);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, key, value) {
    (_.has(result, key) ? result[key] : (result[key] = [])).push(value);
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, key, value) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, key) {
    _.has(result, key) ? result[key]++ : result[key] = 1;
  });

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator, context) {
    iterator = iterator == null ? _.identity : lookupIterator(iterator);
    var value = iterator.call(context, obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >>> 1;
      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    return (n == null) || guard ? array[0] : slice.call(array, 0, n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n == null) || guard) {
      return array[array.length - 1];
    } else {
      return slice.call(array, Math.max(array.length - n, 0));
    }
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, (n == null) || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, output) {
    if (shallow && _.every(input, _.isArray)) {
      return concat.apply(output, input);
    }
    each(input, function(value) {
      if (_.isArray(value) || _.isArguments(value)) {
        shallow ? push.apply(output, value) : flatten(value, shallow, output);
      } else {
        output.push(value);
      }
    });
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator, context) {
    if (_.isFunction(isSorted)) {
      context = iterator;
      iterator = isSorted;
      isSorted = false;
    }
    var initial = iterator ? _.map(array, iterator, context) : array;
    var results = [];
    var seen = [];
    each(initial, function(value, index) {
      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
        seen.push(value);
        results.push(array[index]);
      }
    });
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(_.flatten(arguments, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.indexOf(other, item) >= 0;
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
    return _.filter(array, function(value){ return !_.contains(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var length = _.max(_.pluck(arguments, "length").concat(0));
    var results = new Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(arguments, '' + i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, length = list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, length = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = (isSorted < 0 ? Math.max(0, length + isSorted) : isSorted);
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var hasIndex = from != null;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
    }
    var i = (hasIndex ? from : array.length);
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(length);

    while(idx < length) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError;
    args = slice.call(arguments, 2);
    return bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      ctor.prototype = func.prototype;
      var self = new ctor;
      ctor.prototype = null;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (Object(result) === result) return result;
      return self;
    };
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context.
  _.partial = function(func) {
    var args = slice.call(arguments, 1);
    return function() {
      return func.apply(this, args.concat(slice.call(arguments)));
    };
  };

  // Bind all of an object's methods to that object. Useful for ensuring that
  // all callbacks defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length === 0) throw new Error("bindAll must be passed function names");
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    options || (options = {});
    var later = function() {
      previous = options.leading === false ? 0 : new Date;
      timeout = null;
      result = func.apply(context, args);
    };
    return function() {
      var now = new Date;
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;
    return function() {
      context = this;
      args = arguments;
      timestamp = new Date();
      var later = function() {
        var last = (new Date()) - timestamp;
        if (last < wait) {
          timeout = setTimeout(later, wait - last);
        } else {
          timeout = null;
          if (!immediate) result = func.apply(context, args);
        }
      };
      var callNow = immediate && !timeout;
      if (!timeout) {
        timeout = setTimeout(later, wait);
      }
      if (callNow) result = func.apply(context, args);
      return result;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return function() {
      var args = [func];
      push.apply(args, arguments);
      return wrapper.apply(this, args);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = nativeKeys || function(obj) {
    if (obj !== Object(obj)) throw new TypeError('Invalid object');
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = new Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = new Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    each(keys, function(key) {
      if (key in obj) copy[key] = obj[key];
    });
    return copy;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    for (var key in obj) {
      if (!_.contains(keys, key)) copy[key] = obj[key];
    }
    return copy;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] === void 0) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] == a) return bStack[length] == b;
    }
    // Objects with different constructors are not equivalent, but `Object`s
    // from different frames are.
    var aCtor = a.constructor, bCtor = b.constructor;
    if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                             _.isFunction(bCtor) && (bCtor instanceof bCtor))) {
      return false;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) == '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Optimize `isFunction` if appropriate.
  if (typeof (/./) !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj === 'function';
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj != +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  // Run a function **n** times.
  _.times = function(n, iterator, context) {
    var accum = Array(Math.max(0, n));
    for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // List of HTML entities for escaping.
  var entityMap = {
    escape: {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    }
  };
  entityMap.unescape = _.invert(entityMap.escape);

  // Regexes containing the keys and values listed immediately above.
  var entityRegexes = {
    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
  };

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  _.each(['escape', 'unescape'], function(method) {
    _[method] = function(string) {
      if (string == null) return '';
      return ('' + string).replace(entityRegexes[method], function(match) {
        return entityMap[method][match];
      });
    };
  });

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return void 0;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\t':     't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    var render;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = new RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset)
        .replace(escaper, function(match) { return '\\' + escapes[match]; });

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      }
      if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      }
      if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }
      index = offset + match.length;
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + "return __p;\n";

    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  _.extend(_.prototype, {

    // Start chaining a wrapped Underscore object.
    chain: function() {
      this._chain = true;
      return this;
    },

    // Extracts the result from a wrapped and chained object.
    value: function() {
      return this._wrapped;
    }

  });

}).call(this);

define("underscore", function(){});

//  Underscore.string
//  (c) 2010 Esa-Matti Suuronen <esa-matti aet suuronen dot org>
//  Underscore.string is freely distributable under the terms of the MIT license.
//  Documentation: https://github.com/epeli/underscore.string
//  Some code is borrowed from MooTools and Alexandru Marasteanu.
//  Version '2.3.2'

!function(root, String){
  

  // Defining helper functions.

  var nativeTrim = String.prototype.trim;
  var nativeTrimRight = String.prototype.trimRight;
  var nativeTrimLeft = String.prototype.trimLeft;

  var parseNumber = function(source) { return source * 1 || 0; };

  var strRepeat = function(str, qty){
    if (qty < 1) return '';
    var result = '';
    while (qty > 0) {
      if (qty & 1) result += str;
      qty >>= 1, str += str;
    }
    return result;
  };

  var slice = [].slice;

  var defaultToWhiteSpace = function(characters) {
    if (characters == null)
      return '\\s';
    else if (characters.source)
      return characters.source;
    else
      return '[' + _s.escapeRegExp(characters) + ']';
  };

  // Helper for toBoolean
  function boolMatch(s, matchers) {
    var i, matcher, down = s.toLowerCase();
    matchers = [].concat(matchers);
    for (i = 0; i < matchers.length; i += 1) {
      matcher = matchers[i];
      if (!matcher) continue;
      if (matcher.test && matcher.test(s)) return true;
      if (matcher.toLowerCase() === down) return true;
    }
  }

  var escapeChars = {
    lt: '<',
    gt: '>',
    quot: '"',
    amp: '&',
    apos: "'"
  };

  var reversedEscapeChars = {};
  for(var key in escapeChars) reversedEscapeChars[escapeChars[key]] = key;
  reversedEscapeChars["'"] = '#39';

  // sprintf() for JavaScript 0.7-beta1
  // http://www.diveintojavascript.com/projects/javascript-sprintf
  //
  // Copyright (c) Alexandru Marasteanu <alexaholic [at) gmail (dot] com>
  // All rights reserved.

  var sprintf = (function() {
    function get_type(variable) {
      return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
    }

    var str_repeat = strRepeat;

    var str_format = function() {
      if (!str_format.cache.hasOwnProperty(arguments[0])) {
        str_format.cache[arguments[0]] = str_format.parse(arguments[0]);
      }
      return str_format.format.call(null, str_format.cache[arguments[0]], arguments);
    };

    str_format.format = function(parse_tree, argv) {
      var cursor = 1, tree_length = parse_tree.length, node_type = '', arg, output = [], i, k, match, pad, pad_character, pad_length;
      for (i = 0; i < tree_length; i++) {
        node_type = get_type(parse_tree[i]);
        if (node_type === 'string') {
          output.push(parse_tree[i]);
        }
        else if (node_type === 'array') {
          match = parse_tree[i]; // convenience purposes only
          if (match[2]) { // keyword argument
            arg = argv[cursor];
            for (k = 0; k < match[2].length; k++) {
              if (!arg.hasOwnProperty(match[2][k])) {
                throw new Error(sprintf('[_.sprintf] property "%s" does not exist', match[2][k]));
              }
              arg = arg[match[2][k]];
            }
          } else if (match[1]) { // positional argument (explicit)
            arg = argv[match[1]];
          }
          else { // positional argument (implicit)
            arg = argv[cursor++];
          }

          if (/[^s]/.test(match[8]) && (get_type(arg) != 'number')) {
            throw new Error(sprintf('[_.sprintf] expecting number but found %s', get_type(arg)));
          }
          switch (match[8]) {
            case 'b': arg = arg.toString(2); break;
            case 'c': arg = String.fromCharCode(arg); break;
            case 'd': arg = parseInt(arg, 10); break;
            case 'e': arg = match[7] ? arg.toExponential(match[7]) : arg.toExponential(); break;
            case 'f': arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg); break;
            case 'o': arg = arg.toString(8); break;
            case 's': arg = ((arg = String(arg)) && match[7] ? arg.substring(0, match[7]) : arg); break;
            case 'u': arg = Math.abs(arg); break;
            case 'x': arg = arg.toString(16); break;
            case 'X': arg = arg.toString(16).toUpperCase(); break;
          }
          arg = (/[def]/.test(match[8]) && match[3] && arg >= 0 ? '+'+ arg : arg);
          pad_character = match[4] ? match[4] == '0' ? '0' : match[4].charAt(1) : ' ';
          pad_length = match[6] - String(arg).length;
          pad = match[6] ? str_repeat(pad_character, pad_length) : '';
          output.push(match[5] ? arg + pad : pad + arg);
        }
      }
      return output.join('');
    };

    str_format.cache = {};

    str_format.parse = function(fmt) {
      var _fmt = fmt, match = [], parse_tree = [], arg_names = 0;
      while (_fmt) {
        if ((match = /^[^\x25]+/.exec(_fmt)) !== null) {
          parse_tree.push(match[0]);
        }
        else if ((match = /^\x25{2}/.exec(_fmt)) !== null) {
          parse_tree.push('%');
        }
        else if ((match = /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/.exec(_fmt)) !== null) {
          if (match[2]) {
            arg_names |= 1;
            var field_list = [], replacement_field = match[2], field_match = [];
            if ((field_match = /^([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
              field_list.push(field_match[1]);
              while ((replacement_field = replacement_field.substring(field_match[0].length)) !== '') {
                if ((field_match = /^\.([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
                  field_list.push(field_match[1]);
                }
                else if ((field_match = /^\[(\d+)\]/.exec(replacement_field)) !== null) {
                  field_list.push(field_match[1]);
                }
                else {
                  throw new Error('[_.sprintf] huh?');
                }
              }
            }
            else {
              throw new Error('[_.sprintf] huh?');
            }
            match[2] = field_list;
          }
          else {
            arg_names |= 2;
          }
          if (arg_names === 3) {
            throw new Error('[_.sprintf] mixing positional and named placeholders is not (yet) supported');
          }
          parse_tree.push(match);
        }
        else {
          throw new Error('[_.sprintf] huh?');
        }
        _fmt = _fmt.substring(match[0].length);
      }
      return parse_tree;
    };

    return str_format;
  })();



  // Defining underscore.string

  var _s = {

    VERSION: '2.3.0',

    isBlank: function(str){
      if (str == null) str = '';
      return (/^\s*$/).test(str);
    },

    stripTags: function(str){
      if (str == null) return '';
      return String(str).replace(/<\/?[^>]+>/g, '');
    },

    capitalize : function(str){
      str = str == null ? '' : String(str);
      return str.charAt(0).toUpperCase() + str.slice(1);
    },

    chop: function(str, step){
      if (str == null) return [];
      str = String(str);
      step = ~~step;
      return step > 0 ? str.match(new RegExp('.{1,' + step + '}', 'g')) : [str];
    },

    clean: function(str){
      return _s.strip(str).replace(/\s+/g, ' ');
    },

    count: function(str, substr){
      if (str == null || substr == null) return 0;

      str = String(str);
      substr = String(substr);

      var count = 0,
        pos = 0,
        length = substr.length;

      while (true) {
        pos = str.indexOf(substr, pos);
        if (pos === -1) break;
        count++;
        pos += length;
      }

      return count;
    },

    chars: function(str) {
      if (str == null) return [];
      return String(str).split('');
    },

    swapCase: function(str) {
      if (str == null) return '';
      return String(str).replace(/\S/g, function(c){
        return c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase();
      });
    },

    escapeHTML: function(str) {
      if (str == null) return '';
      return String(str).replace(/[&<>"']/g, function(m){ return '&' + reversedEscapeChars[m] + ';'; });
    },

    unescapeHTML: function(str) {
      if (str == null) return '';
      return String(str).replace(/\&([^;]+);/g, function(entity, entityCode){
        var match;

        if (entityCode in escapeChars) {
          return escapeChars[entityCode];
        } else if (match = entityCode.match(/^#x([\da-fA-F]+)$/)) {
          return String.fromCharCode(parseInt(match[1], 16));
        } else if (match = entityCode.match(/^#(\d+)$/)) {
          return String.fromCharCode(~~match[1]);
        } else {
          return entity;
        }
      });
    },

    escapeRegExp: function(str){
      if (str == null) return '';
      return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
    },

    splice: function(str, i, howmany, substr){
      var arr = _s.chars(str);
      arr.splice(~~i, ~~howmany, substr);
      return arr.join('');
    },

    insert: function(str, i, substr){
      return _s.splice(str, i, 0, substr);
    },

    include: function(str, needle){
      if (needle === '') return true;
      if (str == null) return false;
      return String(str).indexOf(needle) !== -1;
    },

    join: function() {
      var args = slice.call(arguments),
        separator = args.shift();

      if (separator == null) separator = '';

      return args.join(separator);
    },

    lines: function(str) {
      if (str == null) return [];
      return String(str).split("\n");
    },

    reverse: function(str){
      return _s.chars(str).reverse().join('');
    },

    startsWith: function(str, starts){
      if (starts === '') return true;
      if (str == null || starts == null) return false;
      str = String(str); starts = String(starts);
      return str.length >= starts.length && str.slice(0, starts.length) === starts;
    },

    endsWith: function(str, ends){
      if (ends === '') return true;
      if (str == null || ends == null) return false;
      str = String(str); ends = String(ends);
      return str.length >= ends.length && str.slice(str.length - ends.length) === ends;
    },

    succ: function(str){
      if (str == null) return '';
      str = String(str);
      return str.slice(0, -1) + String.fromCharCode(str.charCodeAt(str.length-1) + 1);
    },

    titleize: function(str){
      if (str == null) return '';
      str  = String(str).toLowerCase();
      return str.replace(/(?:^|\s|-)\S/g, function(c){ return c.toUpperCase(); });
    },

    camelize: function(str){
      return _s.trim(str).replace(/[-_\s]+(.)?/g, function(match, c){ return c ? c.toUpperCase() : ""; });
    },

    underscored: function(str){
      return _s.trim(str).replace(/([a-z\d])([A-Z]+)/g, '$1_$2').replace(/[-\s]+/g, '_').toLowerCase();
    },

    dasherize: function(str){
      return _s.trim(str).replace(/([A-Z])/g, '-$1').replace(/[-_\s]+/g, '-').toLowerCase();
    },

    classify: function(str){
      return _s.titleize(String(str).replace(/[\W_]/g, ' ')).replace(/\s/g, '');
    },

    humanize: function(str){
      return _s.capitalize(_s.underscored(str).replace(/_id$/,'').replace(/_/g, ' '));
    },

    trim: function(str, characters){
      if (str == null) return '';
      if (!characters && nativeTrim) return nativeTrim.call(str);
      characters = defaultToWhiteSpace(characters);
      return String(str).replace(new RegExp('\^' + characters + '+|' + characters + '+$', 'g'), '');
    },

    ltrim: function(str, characters){
      if (str == null) return '';
      if (!characters && nativeTrimLeft) return nativeTrimLeft.call(str);
      characters = defaultToWhiteSpace(characters);
      return String(str).replace(new RegExp('^' + characters + '+'), '');
    },

    rtrim: function(str, characters){
      if (str == null) return '';
      if (!characters && nativeTrimRight) return nativeTrimRight.call(str);
      characters = defaultToWhiteSpace(characters);
      return String(str).replace(new RegExp(characters + '+$'), '');
    },

    truncate: function(str, length, truncateStr){
      if (str == null) return '';
      str = String(str); truncateStr = truncateStr || '...';
      length = ~~length;
      return str.length > length ? str.slice(0, length) + truncateStr : str;
    },

    /**
     * _s.prune: a more elegant version of truncate
     * prune extra chars, never leaving a half-chopped word.
     * @author github.com/rwz
     */
    prune: function(str, length, pruneStr){
      if (str == null) return '';

      str = String(str); length = ~~length;
      pruneStr = pruneStr != null ? String(pruneStr) : '...';

      if (str.length <= length) return str;

      var tmpl = function(c){ return c.toUpperCase() !== c.toLowerCase() ? 'A' : ' '; },
        template = str.slice(0, length+1).replace(/.(?=\W*\w*$)/g, tmpl); // 'Hello, world' -> 'HellAA AAAAA'

      if (template.slice(template.length-2).match(/\w\w/))
        template = template.replace(/\s*\S+$/, '');
      else
        template = _s.rtrim(template.slice(0, template.length-1));

      return (template+pruneStr).length > str.length ? str : str.slice(0, template.length)+pruneStr;
    },

    words: function(str, delimiter) {
      if (_s.isBlank(str)) return [];
      return _s.trim(str, delimiter).split(delimiter || /\s+/);
    },

    pad: function(str, length, padStr, type) {
      str = str == null ? '' : String(str);
      length = ~~length;

      var padlen  = 0;

      if (!padStr)
        padStr = ' ';
      else if (padStr.length > 1)
        padStr = padStr.charAt(0);

      switch(type) {
        case 'right':
          padlen = length - str.length;
          return str + strRepeat(padStr, padlen);
        case 'both':
          padlen = length - str.length;
          return strRepeat(padStr, Math.ceil(padlen/2)) + str
                  + strRepeat(padStr, Math.floor(padlen/2));
        default: // 'left'
          padlen = length - str.length;
          return strRepeat(padStr, padlen) + str;
        }
    },

    lpad: function(str, length, padStr) {
      return _s.pad(str, length, padStr);
    },

    rpad: function(str, length, padStr) {
      return _s.pad(str, length, padStr, 'right');
    },

    lrpad: function(str, length, padStr) {
      return _s.pad(str, length, padStr, 'both');
    },

    sprintf: sprintf,

    vsprintf: function(fmt, argv){
      argv.unshift(fmt);
      return sprintf.apply(null, argv);
    },

    toNumber: function(str, decimals) {
      if (!str) return 0;
      str = _s.trim(str);
      if (!str.match(/^-?\d+(?:\.\d+)?$/)) return NaN;
      return parseNumber(parseNumber(str).toFixed(~~decimals));
    },

    numberFormat : function(number, dec, dsep, tsep) {
      if (isNaN(number) || number == null) return '';

      number = number.toFixed(~~dec);
      tsep = typeof tsep == 'string' ? tsep : ',';

      var parts = number.split('.'), fnums = parts[0],
        decimals = parts[1] ? (dsep || '.') + parts[1] : '';

      return fnums.replace(/(\d)(?=(?:\d{3})+$)/g, '$1' + tsep) + decimals;
    },

    strRight: function(str, sep){
      if (str == null) return '';
      str = String(str); sep = sep != null ? String(sep) : sep;
      var pos = !sep ? -1 : str.indexOf(sep);
      return ~pos ? str.slice(pos+sep.length, str.length) : str;
    },

    strRightBack: function(str, sep){
      if (str == null) return '';
      str = String(str); sep = sep != null ? String(sep) : sep;
      var pos = !sep ? -1 : str.lastIndexOf(sep);
      return ~pos ? str.slice(pos+sep.length, str.length) : str;
    },

    strLeft: function(str, sep){
      if (str == null) return '';
      str = String(str); sep = sep != null ? String(sep) : sep;
      var pos = !sep ? -1 : str.indexOf(sep);
      return ~pos ? str.slice(0, pos) : str;
    },

    strLeftBack: function(str, sep){
      if (str == null) return '';
      str += ''; sep = sep != null ? ''+sep : sep;
      var pos = str.lastIndexOf(sep);
      return ~pos ? str.slice(0, pos) : str;
    },

    toSentence: function(array, separator, lastSeparator, serial) {
      separator = separator || ', ';
      lastSeparator = lastSeparator || ' and ';
      var a = array.slice(), lastMember = a.pop();

      if (array.length > 2 && serial) lastSeparator = _s.rtrim(separator) + lastSeparator;

      return a.length ? a.join(separator) + lastSeparator + lastMember : lastMember;
    },

    toSentenceSerial: function() {
      var args = slice.call(arguments);
      args[3] = true;
      return _s.toSentence.apply(_s, args);
    },

    slugify: function(str) {
      if (str == null) return '';

      var from  = "ąàáäâãåæăćęèéëêìíïîłńòóöôõøśșțùúüûñçżź",
          to    = "aaaaaaaaaceeeeeiiiilnoooooosstuuuunczz",
          regex = new RegExp(defaultToWhiteSpace(from), 'g');

      str = String(str).toLowerCase().replace(regex, function(c){
        var index = from.indexOf(c);
        return to.charAt(index) || '-';
      });

      return _s.dasherize(str.replace(/[^\w\s-]/g, ''));
    },

    surround: function(str, wrapper) {
      return [wrapper, str, wrapper].join('');
    },

    quote: function(str, quoteChar) {
      return _s.surround(str, quoteChar || '"');
    },

    unquote: function(str, quoteChar) {
      quoteChar = quoteChar || '"';
      if (str[0] === quoteChar && str[str.length-1] === quoteChar)
        return str.slice(1,str.length-1);
      else return str;
    },

    exports: function() {
      var result = {};

      for (var prop in this) {
        if (!this.hasOwnProperty(prop) || prop.match(/^(?:include|contains|reverse)$/)) continue;
        result[prop] = this[prop];
      }

      return result;
    },

    repeat: function(str, qty, separator){
      if (str == null) return '';

      qty = ~~qty;

      // using faster implementation if separator is not needed;
      if (separator == null) return strRepeat(String(str), qty);

      // this one is about 300x slower in Google Chrome
      for (var repeat = []; qty > 0; repeat[--qty] = str) {}
      return repeat.join(separator);
    },

    naturalCmp: function(str1, str2){
      if (str1 == str2) return 0;
      if (!str1) return -1;
      if (!str2) return 1;

      var cmpRegex = /(\.\d+)|(\d+)|(\D+)/g,
        tokens1 = String(str1).toLowerCase().match(cmpRegex),
        tokens2 = String(str2).toLowerCase().match(cmpRegex),
        count = Math.min(tokens1.length, tokens2.length);

      for(var i = 0; i < count; i++) {
        var a = tokens1[i], b = tokens2[i];

        if (a !== b){
          var num1 = parseInt(a, 10);
          if (!isNaN(num1)){
            var num2 = parseInt(b, 10);
            if (!isNaN(num2) && num1 - num2)
              return num1 - num2;
          }
          return a < b ? -1 : 1;
        }
      }

      if (tokens1.length === tokens2.length)
        return tokens1.length - tokens2.length;

      return str1 < str2 ? -1 : 1;
    },

    levenshtein: function(str1, str2) {
      if (str1 == null && str2 == null) return 0;
      if (str1 == null) return String(str2).length;
      if (str2 == null) return String(str1).length;

      str1 = String(str1); str2 = String(str2);

      var current = [], prev, value;

      for (var i = 0; i <= str2.length; i++)
        for (var j = 0; j <= str1.length; j++) {
          if (i && j)
            if (str1.charAt(j - 1) === str2.charAt(i - 1))
              value = prev;
            else
              value = Math.min(current[j], current[j - 1], prev) + 1;
          else
            value = i + j;

          prev = current[j];
          current[j] = value;
        }

      return current.pop();
    },

    toBoolean: function(str, trueValues, falseValues) {
      if (typeof str === "number") str = "" + str;
      if (typeof str !== "string") return !!str;
      str = _s.trim(str);
      if (boolMatch(str, trueValues || ["true", "1"])) return true;
      if (boolMatch(str, falseValues || ["false", "0"])) return false;
    }
  };

  // Aliases

  _s.strip    = _s.trim;
  _s.lstrip   = _s.ltrim;
  _s.rstrip   = _s.rtrim;
  _s.center   = _s.lrpad;
  _s.rjust    = _s.lpad;
  _s.ljust    = _s.rpad;
  _s.contains = _s.include;
  _s.q        = _s.quote;
  _s.toBool   = _s.toBoolean;

  // Exporting

  // CommonJS module is defined
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports)
      module.exports = _s;

    exports._s = _s;
  }

  // Register as a named module with AMD.
  if (typeof define === 'function' && define.amd)
    define('underscore.string', [], function(){ return _s; });


  // Integrate with Underscore.js if defined
  // or create our own underscore object.
  root._ = root._ || {};
  root._.string = root._.str = _s;
}(this, String);

/* parser generated by jison 0.4.13 */
/*
  Returns a Parser object of the following structure:

  Parser: {
    yy: {}
  }

  Parser.prototype: {
    yy: {},
    trace: function(),
    symbols_: {associative list: name ==> number},
    terminals_: {associative list: number ==> name},
    productions_: [...],
    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$),
    table: [...],
    defaultActions: {...},
    parseError: function(str, hash),
    parse: function(input),

    lexer: {
        EOF: 1,
        parseError: function(str, hash),
        setInput: function(input),
        input: function(),
        unput: function(str),
        more: function(),
        less: function(n),
        pastInput: function(),
        upcomingInput: function(),
        showPosition: function(),
        test_match: function(regex_match_array, rule_index),
        next: function(),
        lex: function(),
        begin: function(condition),
        popState: function(),
        _currentRules: function(),
        topState: function(),
        pushState: function(condition),

        options: {
            ranges: boolean           (optional: true ==> token location info will include a .range[] member)
            flex: boolean             (optional: true ==> flex-like lexing behaviour where the rules are tested exhaustively to find the longest match)
            backtrack_lexer: boolean  (optional: true ==> lexer regexes are tested in order and for each matching regex the action code is invoked; the lexer terminates the scan when a token is returned by the action code)
        },

        performAction: function(yy, yy_, $avoiding_name_collisions, YY_START),
        rules: [...],
        conditions: {associative list: name ==> set},
    }
  }


  token location info (@$, _$, etc.): {
    first_line: n,
    last_line: n,
    first_column: n,
    last_column: n,
    range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
  }


  the parseError function receives a 'hash' object with these members for lexer and parser errors: {
    text:        (matched text)
    token:       (the produced terminal token, if any)
    line:        (yylineno)
  }
  while parser (grammar) errors will also provide these members, i.e. parser errors deliver a superset of attributes: {
    loc:         (yylloc)
    expected:    (string describing the set of expected tokens)
    recoverable: (boolean: TRUE when the parser has a error recovery rule available for this particular error)
  }
*/
var parser = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"Program":3,"ProgramSection":4,"StatementList":5,"Statement":6,"ExpressionStatement":7,"CodeSegment":8,"LoopStatement":9,"JumpStatement":10,"SEMICOLON":11,"Expression":12,"ChuckExpression":13,"COMMA":14,"ArrowExpression":15,"ChuckOperator":16,"DeclExpression":17,"ConditionalExpression":18,"TypeDecl":19,"VarDeclList":20,"VarDecl":21,"ID":22,"ArrayExpression":23,"ArrayEmpty":24,"Literal":25,"NULL":26,"TypeDeclA":27,"TypeDeclB":28,"AT_SYM":29,"LT":30,"IdDot":31,"GT":32,"LogicalOrExpression":33,"LogicalAndExpression":34,"InclusiveOrExpression":35,"ExclusiveOrExpression":36,"AndExpression":37,"EqualityExpression":38,"RelationalExpression":39,"ShiftExpression":40,"AdditiveExpression":41,"MultiplicativeExpression":42,"PLUS":43,"MINUS":44,"TildaExpression":45,"TIMES":46,"CastExpression":47,"UnaryExpression":48,"DurExpression":49,"PLUSPLUS":50,"PostfixExpression":51,"COLONCOLON":52,"PrimaryExpression":53,"LPAREN":54,"RPAREN":55,"DOT":56,"NUMBER":57,"FLOAT":58,"STRING_LIT":59,"L_HACK":60,"R_HACK":61,"WHILE":62,"FOR":63,"LBRACE":64,"RBRACE":65,"BREAK":66,"LBRACK":67,"RBRACK":68,"CHUCK":69,"UNCHUCK":70,"$accept":0,"$end":1},
terminals_: {2:"error",11:"SEMICOLON",14:"COMMA",22:"ID",26:"NULL",29:"AT_SYM",30:"LT",32:"GT",43:"PLUS",44:"MINUS",46:"TIMES",50:"PLUSPLUS",52:"COLONCOLON",54:"LPAREN",55:"RPAREN",56:"DOT",57:"NUMBER",58:"FLOAT",59:"STRING_LIT",60:"L_HACK",61:"R_HACK",62:"WHILE",63:"FOR",64:"LBRACE",65:"RBRACE",66:"BREAK",67:"LBRACK",68:"RBRACK",69:"CHUCK",70:"UNCHUCK"},
productions_: [0,[3,1],[4,1],[5,1],[5,2],[6,1],[6,1],[6,1],[6,1],[7,1],[7,2],[12,1],[12,3],[13,1],[13,3],[15,1],[17,1],[17,2],[20,1],[21,1],[21,2],[21,2],[25,1],[19,1],[19,1],[27,1],[27,2],[28,3],[28,4],[18,1],[33,1],[34,1],[35,1],[36,1],[37,1],[38,1],[39,1],[39,3],[39,3],[40,1],[41,1],[41,3],[41,3],[42,1],[42,3],[45,1],[47,1],[48,1],[48,2],[49,1],[49,3],[51,1],[51,2],[51,4],[51,3],[51,2],[53,1],[53,1],[53,1],[53,1],[53,3],[9,5],[9,7],[8,2],[8,3],[10,2],[31,1],[31,3],[23,3],[24,2],[16,1],[16,1]],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1:return this.$ = yy.addLocationDataFn(_$[$0], _$[$0])(new yy.Program([$$[$0]]));
break;
case 2:this.$ = $$[$0];
break;
case 3:this.$ = yy.addLocationDataFn(_$[$0], _$[$0])([$$[$0]]);
break;
case 4:this.$ = yy.addLocationDataFn(_$[$0-1], _$[$0])([$$[$0-1]].concat($$[$0]));
break;
case 5:this.$ = $$[$0];
break;
case 6:this.$ = $$[$0];
break;
case 7:this.$ = $$[$0];
break;
case 8:this.$ = $$[$0];
break;
case 9:this.$ = yy.addLocationDataFn(_$[$0], _$[$0])(void 0);
break;
case 10:this.$ = yy.addLocationDataFn(_$[$0-1], _$[$0])(new yy.ExpressionStatement($$[$0-1]));
break;
case 11:this.$ = yy.addLocationDataFn(_$[$0], _$[$0])(new yy.ExpressionList($$[$0]));
break;
case 12:this.$ = yy.addLocationDataFn(_$[$0-2], _$[$0])($$[$0].prepend($$[$0-2]));
break;
case 13:this.$ = $$[$0];
break;
case 14:this.$ = yy.addLocationDataFn(_$[$0-2], _$[$0])(new yy.BinaryExpression($$[$0-2], $$[$0-1], $$[$0]));
break;
case 15:this.$ = $$[$0];
break;
case 16:this.$ = $$[$0];
break;
case 17:this.$ = yy.addLocationDataFn(_$[$0-1], _$[$0])(new yy.DeclarationExpression($$[$0-1], $$[$0], 0));
break;
case 18:this.$ = yy.addLocationDataFn(_$[$0], _$[$0])([$$[$0]]);
break;
case 19:this.$ = yy.addLocationDataFn(_$[$0], _$[$0])(new yy.VariableDeclaration($$[$0]));
break;
case 20:this.$ = yy.addLocationDataFn(_$[$0-1], _$[$0])(new yy.VariableDeclaration($$[$0-1], $$[$0]));
break;
case 21:this.$ = yy.addLocationDataFn(_$[$0-1], _$[$0])(new yy.VariableDeclaration($$[$0-1], $$[$0]));
break;
case 22:this.$ = yy.addLocationDataFn(_$[$0], _$[$0])(new yy.Null);
break;
case 23:this.$ = $$[$0];
break;
case 24:this.$ = $$[$0];
break;
case 25:this.$ = yy.addLocationDataFn(_$[$0], _$[$0])(new yy.TypeDeclaration($$[$0], 0));
break;
case 26:this.$ = yy.addLocationDataFn(_$[$0-1], _$[$0])(new yy.TypeDeclaration($$[$0-1], 1));
break;
case 27:this.$ = yy.addLocationDataFn(_$[$0-2], _$[$0])(new yy.TypeDeclaration($$[$0-1], 0));
break;
case 28:this.$ = yy.addLocationDataFn(_$[$0-3], _$[$0])(new yy.TypeDeclaration($$[$0-2], 1));
break;
case 29:this.$ = $$[$0];
break;
case 30:this.$ = $$[$0];
break;
case 31:this.$ = $$[$0];
break;
case 32:this.$ = $$[$0];
break;
case 33:this.$ = $$[$0];
break;
case 34:this.$ = $$[$0];
break;
case 35:this.$ = $$[$0];
break;
case 36:this.$ = $$[$0];
break;
case 37:this.$ = yy.addLocationDataFn(_$[$0-2], _$[$0])(new yy.BinaryExpression($$[$0-2], new yy.LtOperator(), $$[$0]));
break;
case 38:this.$ = yy.addLocationDataFn(_$[$0-2], _$[$0])(new yy.BinaryExpression($$[$0-2], new yy.GtOperator(), $$[$0]));
break;
case 39:this.$ = $$[$0];
break;
case 40:this.$ = $$[$0];
break;
case 41:this.$ = yy.addLocationDataFn(_$[$0-2], _$[$0])(new yy.BinaryExpression($$[$0-2], new yy.PlusOperator(), $$[$0]));
break;
case 42:this.$ = yy.addLocationDataFn(_$[$0-2], _$[$0])(new yy.BinaryExpression($$[$0-2], new yy.MinusOperator(), $$[$0]));
break;
case 43:this.$ = $$[$0];
break;
case 44:this.$ = yy.addLocationDataFn(_$[$0-2], _$[$0])(new yy.BinaryExpression($$[$0-2], new yy.TimesOperator(), $$[$0]));
break;
case 45:this.$ = $$[$0];
break;
case 46:this.$ = $$[$0];
break;
case 47:this.$ = $$[$0];
break;
case 48:this.$ = yy.addLocationDataFn(_$[$0-1], _$[$0])(new yy.UnaryExpression(new yy.PrefixPlusPlusOperator(), $$[$0]));
break;
case 49:this.$ = $$[$0];
break;
case 50:this.$ = yy.addLocationDataFn(_$[$0-2], _$[$0])(new yy.DurExpression($$[$0-2], $$[$0]));
break;
case 51:this.$ = $$[$0];
break;
case 52:this.$ = yy.addLocationDataFn(_$[$0-1], _$[$0])(new yy.PrimaryArrayExpression($$[$0-1], $$[$0]));
break;
case 53:this.$ = yy.addLocationDataFn(_$[$0-3], _$[$0])(new yy.FuncCallExpression($$[$0-3], $$[$0-1]));
break;
case 54:this.$ = yy.addLocationDataFn(_$[$0-2], _$[$0])(new yy.DotMemberExpression($$[$0-2], $$[$0]));
break;
case 55:this.$ = yy.addLocationDataFn(_$[$0-1], _$[$0])(new yy.PostfixExpression($$[$0-1], new yy.PostfixPlusPlusOperator()));
break;
case 56:this.$ = yy.addLocationDataFn(_$[$0], _$[$0])(new yy.PrimaryVariableExpression($$[$0]));
break;
case 57:this.$ = yy.addLocationDataFn(_$[$0], _$[$0])(new yy.PrimaryIntExpression($$[$0]));
break;
case 58:this.$ = yy.addLocationDataFn(_$[$0], _$[$0])(new yy.PrimaryFloatExpression($$[$0]));
break;
case 59:this.$ = yy.addLocationDataFn(_$[$0], _$[$0])(new yy.PrimaryStringExpression($$[$0]));
break;
case 60:this.$ = yy.addLocationDataFn(_$[$0-2], _$[$0])(new yy.PrimaryHackExpression($$[$0-1]));
break;
case 61:this.$ = yy.addLocationDataFn(_$[$0-4], _$[$0])(new yy.WhileStatement($$[$0-2], $$[$0]));
break;
case 62:this.$ = yy.addLocationDataFn(_$[$0-6], _$[$0])(new yy.ForStatement($$[$0-4], $$[$0-3], $$[$0-2], $$[$0]));
break;
case 63:this.$ = yy.addLocationDataFn(_$[$0-1], _$[$0])(new yy.CodeStatement());
break;
case 64:this.$ = yy.addLocationDataFn(_$[$0-2], _$[$0])(new yy.CodeStatement($$[$0-1]));
break;
case 65:this.$ = yy.addLocationDataFn(_$[$0-1], _$[$0])(new yy.BreakStatement());
break;
case 66:this.$ = yy.addLocationDataFn(_$[$0], _$[$0])([$$[$0]]);
break;
case 67:this.$ = yy.addLocationDataFn(_$[$0-2], _$[$0])($$[$0].push($$[$0-2]));
break;
case 68:this.$ = yy.addLocationDataFn(_$[$0-2], _$[$0])(new yy.ArraySub($$[$0-1]));
break;
case 69:this.$ = yy.addLocationDataFn(_$[$0-1], _$[$0])(new yy.ArraySub());
break;
case 70:this.$ = yy.addLocationDataFn(_$[$0], _$[$0])(new yy.ChuckOperator());
break;
case 71:this.$ = yy.addLocationDataFn(_$[$0], _$[$0])(new yy.UnchuckOperator());
break;
}
},
table: [{3:1,4:2,5:3,6:4,7:5,8:6,9:7,10:8,11:[1,9],12:10,13:15,15:16,17:17,18:18,19:19,22:[1,24],27:21,28:22,30:[1,25],33:20,34:23,35:26,36:27,37:28,38:29,39:30,40:31,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44],62:[1,12],63:[1,13],64:[1,11],66:[1,14]},{1:[3]},{1:[2,1]},{1:[2,2]},{1:[2,3],5:45,6:4,7:5,8:6,9:7,10:8,11:[1,9],12:10,13:15,15:16,17:17,18:18,19:19,22:[1,24],27:21,28:22,30:[1,25],33:20,34:23,35:26,36:27,37:28,38:29,39:30,40:31,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44],62:[1,12],63:[1,13],64:[1,11],65:[2,3],66:[1,14]},{1:[2,5],11:[2,5],22:[2,5],30:[2,5],50:[2,5],57:[2,5],58:[2,5],59:[2,5],60:[2,5],62:[2,5],63:[2,5],64:[2,5],65:[2,5],66:[2,5]},{1:[2,6],11:[2,6],22:[2,6],30:[2,6],50:[2,6],57:[2,6],58:[2,6],59:[2,6],60:[2,6],62:[2,6],63:[2,6],64:[2,6],65:[2,6],66:[2,6]},{1:[2,7],11:[2,7],22:[2,7],30:[2,7],50:[2,7],57:[2,7],58:[2,7],59:[2,7],60:[2,7],62:[2,7],63:[2,7],64:[2,7],65:[2,7],66:[2,7]},{1:[2,8],11:[2,8],22:[2,8],30:[2,8],50:[2,8],57:[2,8],58:[2,8],59:[2,8],60:[2,8],62:[2,8],63:[2,8],64:[2,8],65:[2,8],66:[2,8]},{1:[2,9],11:[2,9],22:[2,9],30:[2,9],50:[2,9],57:[2,9],58:[2,9],59:[2,9],60:[2,9],62:[2,9],63:[2,9],64:[2,9],65:[2,9],66:[2,9]},{11:[1,46]},{5:48,6:4,7:5,8:6,9:7,10:8,11:[1,9],12:10,13:15,15:16,17:17,18:18,19:19,22:[1,24],27:21,28:22,30:[1,25],33:20,34:23,35:26,36:27,37:28,38:29,39:30,40:31,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44],62:[1,12],63:[1,13],64:[1,11],65:[1,47],66:[1,14]},{54:[1,49]},{54:[1,50]},{11:[1,51]},{11:[2,11],14:[1,52],16:53,55:[2,11],61:[2,11],68:[2,11],69:[1,54],70:[1,55]},{11:[2,13],14:[2,13],55:[2,13],61:[2,13],68:[2,13],69:[2,13],70:[2,13]},{11:[2,15],14:[2,15],55:[2,15],61:[2,15],68:[2,15],69:[2,15],70:[2,15]},{11:[2,16],14:[2,16],55:[2,16],61:[2,16],68:[2,16],69:[2,16],70:[2,16]},{20:56,21:57,22:[1,58]},{11:[2,29],14:[2,29],55:[2,29],61:[2,29],68:[2,29],69:[2,29],70:[2,29]},{22:[2,23]},{22:[2,24]},{11:[2,30],14:[2,30],55:[2,30],61:[2,30],68:[2,30],69:[2,30],70:[2,30]},{11:[2,56],14:[2,56],22:[2,25],29:[1,59],30:[2,56],32:[2,56],43:[2,56],44:[2,56],46:[2,56],50:[2,56],52:[2,56],54:[2,56],55:[2,56],56:[2,56],61:[2,56],67:[2,56],68:[2,56],69:[2,56],70:[2,56]},{22:[1,61],31:60},{11:[2,31],14:[2,31],55:[2,31],61:[2,31],68:[2,31],69:[2,31],70:[2,31]},{11:[2,32],14:[2,32],55:[2,32],61:[2,32],68:[2,32],69:[2,32],70:[2,32]},{11:[2,33],14:[2,33],55:[2,33],61:[2,33],68:[2,33],69:[2,33],70:[2,33]},{11:[2,34],14:[2,34],55:[2,34],61:[2,34],68:[2,34],69:[2,34],70:[2,34]},{11:[2,35],14:[2,35],30:[1,62],32:[1,63],55:[2,35],61:[2,35],68:[2,35],69:[2,35],70:[2,35]},{11:[2,36],14:[2,36],30:[2,36],32:[2,36],55:[2,36],61:[2,36],68:[2,36],69:[2,36],70:[2,36]},{11:[2,39],14:[2,39],30:[2,39],32:[2,39],43:[1,64],44:[1,65],55:[2,39],61:[2,39],68:[2,39],69:[2,39],70:[2,39]},{11:[2,40],14:[2,40],30:[2,40],32:[2,40],43:[2,40],44:[2,40],46:[1,66],55:[2,40],61:[2,40],68:[2,40],69:[2,40],70:[2,40]},{11:[2,43],14:[2,43],30:[2,43],32:[2,43],43:[2,43],44:[2,43],46:[2,43],55:[2,43],61:[2,43],68:[2,43],69:[2,43],70:[2,43]},{11:[2,45],14:[2,45],30:[2,45],32:[2,45],43:[2,45],44:[2,45],46:[2,45],55:[2,45],61:[2,45],68:[2,45],69:[2,45],70:[2,45]},{11:[2,46],14:[2,46],30:[2,46],32:[2,46],43:[2,46],44:[2,46],46:[2,46],55:[2,46],61:[2,46],68:[2,46],69:[2,46],70:[2,46]},{11:[2,47],14:[2,47],30:[2,47],32:[2,47],43:[2,47],44:[2,47],46:[2,47],52:[1,67],55:[2,47],61:[2,47],68:[2,47],69:[2,47],70:[2,47]},{22:[1,69],48:68,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44]},{11:[2,49],14:[2,49],23:70,30:[2,49],32:[2,49],43:[2,49],44:[2,49],46:[2,49],50:[1,73],52:[2,49],54:[1,71],55:[2,49],56:[1,72],61:[2,49],67:[1,74],68:[2,49],69:[2,49],70:[2,49]},{11:[2,51],14:[2,51],30:[2,51],32:[2,51],43:[2,51],44:[2,51],46:[2,51],50:[2,51],52:[2,51],54:[2,51],55:[2,51],56:[2,51],61:[2,51],67:[2,51],68:[2,51],69:[2,51],70:[2,51]},{11:[2,57],14:[2,57],30:[2,57],32:[2,57],43:[2,57],44:[2,57],46:[2,57],50:[2,57],52:[2,57],54:[2,57],55:[2,57],56:[2,57],61:[2,57],67:[2,57],68:[2,57],69:[2,57],70:[2,57]},{11:[2,58],14:[2,58],30:[2,58],32:[2,58],43:[2,58],44:[2,58],46:[2,58],50:[2,58],52:[2,58],54:[2,58],55:[2,58],56:[2,58],61:[2,58],67:[2,58],68:[2,58],69:[2,58],70:[2,58]},{11:[2,59],14:[2,59],30:[2,59],32:[2,59],43:[2,59],44:[2,59],46:[2,59],50:[2,59],52:[2,59],54:[2,59],55:[2,59],56:[2,59],61:[2,59],67:[2,59],68:[2,59],69:[2,59],70:[2,59]},{12:75,13:15,15:16,17:17,18:18,19:19,22:[1,24],27:21,28:22,30:[1,25],33:20,34:23,35:26,36:27,37:28,38:29,39:30,40:31,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44]},{1:[2,4],65:[2,4]},{1:[2,10],11:[2,10],22:[2,10],30:[2,10],50:[2,10],57:[2,10],58:[2,10],59:[2,10],60:[2,10],62:[2,10],63:[2,10],64:[2,10],65:[2,10],66:[2,10]},{1:[2,63],11:[2,63],22:[2,63],30:[2,63],50:[2,63],57:[2,63],58:[2,63],59:[2,63],60:[2,63],62:[2,63],63:[2,63],64:[2,63],65:[2,63],66:[2,63]},{65:[1,76]},{12:77,13:15,15:16,17:17,18:18,19:19,22:[1,24],27:21,28:22,30:[1,25],33:20,34:23,35:26,36:27,37:28,38:29,39:30,40:31,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44]},{7:78,11:[1,9],12:10,13:15,15:16,17:17,18:18,19:19,22:[1,24],27:21,28:22,30:[1,25],33:20,34:23,35:26,36:27,37:28,38:29,39:30,40:31,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44]},{1:[2,65],11:[2,65],22:[2,65],30:[2,65],50:[2,65],57:[2,65],58:[2,65],59:[2,65],60:[2,65],62:[2,65],63:[2,65],64:[2,65],65:[2,65],66:[2,65]},{12:79,13:15,15:16,17:17,18:18,19:19,22:[1,24],27:21,28:22,30:[1,25],33:20,34:23,35:26,36:27,37:28,38:29,39:30,40:31,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44]},{15:80,17:17,18:18,19:19,22:[1,24],27:21,28:22,30:[1,25],33:20,34:23,35:26,36:27,37:28,38:29,39:30,40:31,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44]},{22:[2,70],30:[2,70],50:[2,70],57:[2,70],58:[2,70],59:[2,70],60:[2,70]},{22:[2,71],30:[2,71],50:[2,71],57:[2,71],58:[2,71],59:[2,71],60:[2,71]},{11:[2,17],14:[2,17],55:[2,17],61:[2,17],68:[2,17],69:[2,17],70:[2,17]},{11:[2,18],14:[2,18],55:[2,18],61:[2,18],68:[2,18],69:[2,18],70:[2,18]},{11:[2,19],14:[2,19],23:81,24:82,55:[2,19],61:[2,19],67:[1,83],68:[2,19],69:[2,19],70:[2,19]},{22:[2,26]},{32:[1,84]},{32:[2,66],56:[1,85]},{22:[1,69],40:86,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44]},{22:[1,69],40:87,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44]},{22:[1,69],42:88,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44]},{22:[1,69],42:89,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44]},{22:[1,69],45:90,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44]},{22:[1,69],51:91,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44]},{11:[2,48],14:[2,48],30:[2,48],32:[2,48],43:[2,48],44:[2,48],46:[2,48],55:[2,48],61:[2,48],68:[2,48],69:[2,48],70:[2,48]},{11:[2,56],14:[2,56],30:[2,56],32:[2,56],43:[2,56],44:[2,56],46:[2,56],50:[2,56],52:[2,56],54:[2,56],55:[2,56],56:[2,56],61:[2,56],67:[2,56],68:[2,56],69:[2,56],70:[2,56]},{11:[2,52],14:[2,52],30:[2,52],32:[2,52],43:[2,52],44:[2,52],46:[2,52],50:[2,52],52:[2,52],54:[2,52],55:[2,52],56:[2,52],61:[2,52],67:[2,52],68:[2,52],69:[2,52],70:[2,52]},{12:92,13:15,15:16,17:17,18:18,19:19,22:[1,24],27:21,28:22,30:[1,25],33:20,34:23,35:26,36:27,37:28,38:29,39:30,40:31,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44]},{22:[1,93]},{11:[2,55],14:[2,55],30:[2,55],32:[2,55],43:[2,55],44:[2,55],46:[2,55],50:[2,55],52:[2,55],54:[2,55],55:[2,55],56:[2,55],61:[2,55],67:[2,55],68:[2,55],69:[2,55],70:[2,55]},{12:94,13:15,15:16,17:17,18:18,19:19,22:[1,24],27:21,28:22,30:[1,25],33:20,34:23,35:26,36:27,37:28,38:29,39:30,40:31,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44]},{61:[1,95]},{1:[2,64],11:[2,64],22:[2,64],30:[2,64],50:[2,64],57:[2,64],58:[2,64],59:[2,64],60:[2,64],62:[2,64],63:[2,64],64:[2,64],65:[2,64],66:[2,64]},{55:[1,96]},{7:97,11:[1,9],12:10,13:15,15:16,17:17,18:18,19:19,22:[1,24],27:21,28:22,30:[1,25],33:20,34:23,35:26,36:27,37:28,38:29,39:30,40:31,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44]},{11:[2,12],55:[2,12],61:[2,12],68:[2,12]},{11:[2,14],14:[2,14],55:[2,14],61:[2,14],68:[2,14],69:[2,14],70:[2,14]},{11:[2,20],14:[2,20],55:[2,20],61:[2,20],68:[2,20],69:[2,20],70:[2,20]},{11:[2,21],14:[2,21],55:[2,21],61:[2,21],68:[2,21],69:[2,21],70:[2,21]},{12:94,13:15,15:16,17:17,18:18,19:19,22:[1,24],27:21,28:22,30:[1,25],33:20,34:23,35:26,36:27,37:28,38:29,39:30,40:31,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44],68:[1,98]},{22:[2,27],29:[1,99]},{22:[1,61],31:100},{11:[2,37],14:[2,37],30:[2,37],32:[2,37],55:[2,37],61:[2,37],68:[2,37],69:[2,37],70:[2,37]},{11:[2,38],14:[2,38],30:[2,38],32:[2,38],55:[2,38],61:[2,38],68:[2,38],69:[2,38],70:[2,38]},{11:[2,41],14:[2,41],30:[2,41],32:[2,41],43:[2,41],44:[2,41],46:[1,66],55:[2,41],61:[2,41],68:[2,41],69:[2,41],70:[2,41]},{11:[2,42],14:[2,42],30:[2,42],32:[2,42],43:[2,42],44:[2,42],46:[1,66],55:[2,42],61:[2,42],68:[2,42],69:[2,42],70:[2,42]},{11:[2,44],14:[2,44],30:[2,44],32:[2,44],43:[2,44],44:[2,44],46:[2,44],55:[2,44],61:[2,44],68:[2,44],69:[2,44],70:[2,44]},{11:[2,50],14:[2,50],23:70,30:[2,50],32:[2,50],43:[2,50],44:[2,50],46:[2,50],50:[1,73],52:[2,50],54:[1,71],55:[2,50],56:[1,72],61:[2,50],67:[1,74],68:[2,50],69:[2,50],70:[2,50]},{55:[1,101]},{11:[2,54],14:[2,54],30:[2,54],32:[2,54],43:[2,54],44:[2,54],46:[2,54],50:[2,54],52:[2,54],54:[2,54],55:[2,54],56:[2,54],61:[2,54],67:[2,54],68:[2,54],69:[2,54],70:[2,54]},{68:[1,102]},{11:[2,60],14:[2,60],30:[2,60],32:[2,60],43:[2,60],44:[2,60],46:[2,60],50:[2,60],52:[2,60],54:[2,60],55:[2,60],56:[2,60],61:[2,60],67:[2,60],68:[2,60],69:[2,60],70:[2,60]},{6:103,7:5,8:6,9:7,10:8,11:[1,9],12:10,13:15,15:16,17:17,18:18,19:19,22:[1,24],27:21,28:22,30:[1,25],33:20,34:23,35:26,36:27,37:28,38:29,39:30,40:31,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44],62:[1,12],63:[1,13],64:[1,11],66:[1,14]},{12:104,13:15,15:16,17:17,18:18,19:19,22:[1,24],27:21,28:22,30:[1,25],33:20,34:23,35:26,36:27,37:28,38:29,39:30,40:31,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44]},{11:[2,69],14:[2,69],55:[2,69],61:[2,69],68:[2,69],69:[2,69],70:[2,69]},{22:[2,28]},{32:[2,67]},{11:[2,53],14:[2,53],30:[2,53],32:[2,53],43:[2,53],44:[2,53],46:[2,53],50:[2,53],52:[2,53],54:[2,53],55:[2,53],56:[2,53],61:[2,53],67:[2,53],68:[2,53],69:[2,53],70:[2,53]},{11:[2,68],14:[2,68],30:[2,68],32:[2,68],43:[2,68],44:[2,68],46:[2,68],50:[2,68],52:[2,68],54:[2,68],55:[2,68],56:[2,68],61:[2,68],67:[2,68],68:[2,68],69:[2,68],70:[2,68]},{1:[2,61],11:[2,61],22:[2,61],30:[2,61],50:[2,61],57:[2,61],58:[2,61],59:[2,61],60:[2,61],62:[2,61],63:[2,61],64:[2,61],65:[2,61],66:[2,61]},{55:[1,105]},{6:106,7:5,8:6,9:7,10:8,11:[1,9],12:10,13:15,15:16,17:17,18:18,19:19,22:[1,24],27:21,28:22,30:[1,25],33:20,34:23,35:26,36:27,37:28,38:29,39:30,40:31,41:32,42:33,45:34,47:35,48:36,49:37,50:[1,38],51:39,53:40,57:[1,41],58:[1,42],59:[1,43],60:[1,44],62:[1,12],63:[1,13],64:[1,11],66:[1,14]},{1:[2,62],11:[2,62],22:[2,62],30:[2,62],50:[2,62],57:[2,62],58:[2,62],59:[2,62],60:[2,62],62:[2,62],63:[2,62],64:[2,62],65:[2,62],66:[2,62]}],
defaultActions: {2:[2,1],3:[2,2],21:[2,23],22:[2,24],59:[2,26],99:[2,28],100:[2,67]},
parseError: function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        throw new Error(str);
    }
},
parse: function parse(input) {
    var self = this, stack = [0], vstack = [null], lstack = [], table = this.table, yytext = '', yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    var args = lstack.slice.call(arguments, 1);
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    this.yy.parser = this;
    if (typeof this.lexer.yylloc == 'undefined') {
        this.lexer.yylloc = {};
    }
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);
    var ranges = this.lexer.options && this.lexer.options.ranges;
    if (typeof this.yy.parseError === 'function') {
        this.parseError = this.yy.parseError;
    } else {
        this.parseError = Object.getPrototypeOf(this).parseError;
    }
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    function lex() {
        var token;
        token = self.lexer.lex() || EOF;
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    }
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol === null || typeof symbol == 'undefined') {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
                    if (typeof action === 'undefined' || !action.length || !action[0]) {
                var errStr = '';
                expected = [];
                for (p in table[state]) {
                    if (this.terminals_[p] && p > TERROR) {
                        expected.push('\'' + this.terminals_[p] + '\'');
                    }
                }
                if (this.lexer.showPosition) {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + this.lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ', got \'' + (this.terminals_[symbol] || symbol) + '\'';
                } else {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' + (symbol == EOF ? 'end of input' : '\'' + (this.terminals_[symbol] || symbol) + '\'');
                }
                this.parseError(errStr, {
                    text: this.lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    line: this.lexer.yylineno,
                    loc: yyloc,
                    expected: expected
                });
            }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(this.lexer.yytext);
            lstack.push(this.lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                if (recovering > 0) {
                    recovering--;
                }
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {
                first_line: lstack[lstack.length - (len || 1)].first_line,
                last_line: lstack[lstack.length - 1].last_line,
                first_column: lstack[lstack.length - (len || 1)].first_column,
                last_column: lstack[lstack.length - 1].last_column
            };
            if (ranges) {
                yyval._$.range = [
                    lstack[lstack.length - (len || 1)].range[0],
                    lstack[lstack.length - 1].range[1]
                ];
            }
            r = this.performAction.apply(yyval, [
                yytext,
                yyleng,
                yylineno,
                this.yy,
                action[1],
                vstack,
                lstack
            ].concat(args));
            if (typeof r !== 'undefined') {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}};

function Parser () {
  this.yy = {};
}
Parser.prototype = parser;parser.Parser = Parser;
return new Parser;
})();


if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = parser;
exports.Parser = parser.Parser;
exports.parse = function () { return parser.parse.apply(parser, arguments); };
exports.main = function commonjsMain(args) {
    if (!args[1]) {
        console.log('Usage: '+args[0]+' FILE');
        process.exit(1);
    }
    var source = require('fs').readFileSync(require('path').normalize(args[1]), "utf8");
    return exports.parser.parse(source);
};
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(process.argv.slice(1));
}
}
window.ChuckParser = parser.Parser;

define("chuck/parser", function(){});

