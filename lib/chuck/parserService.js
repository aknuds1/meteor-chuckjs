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
