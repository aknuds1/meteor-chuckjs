(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  define("chuck/lexer", ["chuck/helpers", "chuck/logging"], function(helpers, logging) {
    var ALIAS_MAP, BOM, COMMENT, FLOAT, IDENTIFIER, KEYWORDS, Lexer, MATCHERS, NUMBER, TRAILING_SPACES, WHITESPACE, count, last, throwSyntaxError;
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
          consumed = this.identifierToken() || this.floatToken() || this.intToken() || this.commentToken() || this._matchToken() || this.whitespaceToken() || this.stringToken() || this.literalToken();
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
        idLength = id.length;
        tag = 'ID';
        if (id in ALIAS_MAP) {
          id = ALIAS_MAP[id];
        }
        if (__indexOf.call(KEYWORDS, id) >= 0) {
          tag = id.toUpperCase();
          logging.debug("Token is a keyword: '" + id + "'");
        } else {
          logging.debug("Token is an identifier: '" + id + "'");
        }
        poppedToken = void 0;
        tagToken = this.token(tag, id, 0, idLength);
        if (poppedToken) {
          _ref = [poppedToken[2].first_line, poppedToken[2].first_column], tagToken[2].first_line = _ref[0], tagToken[2].first_column = _ref[1];
        }
        logging.debug("Consumed ID of length " + idLength);
        return idLength;
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
          logging.debug("Consuming whitespace of length " + match[0].length);
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
      '@=>': 'AT_CHUCK',
      '\\+=>': 'PLUS_CHUCK',
      '-=>': 'MINUS_CHUCK',
      '::': 'COLONCOLON',
      '<<<': 'L_HACK',
      '>>>': 'R_HACK',
      '\\(': 'LPAREN',
      '\\)': 'RPAREN',
      '\\{': 'LBRACE',
      '\\}': 'RBRACE',
      '\\.': 'DOT',
      '\\+': 'PLUS',
      '-': 'MINUS',
      '\\*': 'TIMES',
      '\\/': 'DIVIDE',
      '<': 'LT',
      '>': 'GT',
      '\\[': 'LBRACK',
      '\\]': 'RBRACK'
    };
    KEYWORDS = ['function', 'while', 'for', 'break'];
    ALIAS_MAP = {
      'fun': 'function'
    };
    return {
      tokenize: function(sourceCode) {
        return new Lexer().tokenize(sourceCode);
      }
    };
  });

}).call(this);
