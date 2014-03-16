Package.describe({
    summary: 'JavaScript (CoffeeScript) parser for the ChucK language'
});

Package.on_use(function (api) {
    api.use('lodash');
    api.use('underscore-string-latest');
    api.use('q');
    api.use('require');

    api.add_files('lib/chuck.js', 'client');
    api.add_files('lib/parser.js', 'client');
    api.add_files('lib/chuck/audioContextService.js', 'client');
    api.add_files('lib/chuck/helpers.js', 'client');
    api.add_files('lib/chuck/instructions.js', 'client');
    api.add_files('lib/chuck/lexer.js', 'client');
    api.add_files('lib/chuck/logging.js', 'client');
    api.add_files('lib/chuck/namespace.js', 'client');
    api.add_files('lib/chuck/nodes.js', 'client');
    api.add_files('lib/chuck/parserService.js', 'client');
    api.add_files('lib/chuck/scanner.js', 'client');
    api.add_files('lib/chuck/types.js', 'client');
    api.add_files('lib/chuck/ugen.js', 'client');
    api.add_files('lib/chuck/vm.js', 'client');
    api.add_files('lib/chuck/libs/math.js', 'client');
});