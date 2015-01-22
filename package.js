Package.describe({
    summary: 'Interpreter for the ChucK music programming language',
    version: "0.2.0",
    name: 'aknudsen:chuckjs',
    git: 'https://github.com/aknuds1/chuck',
});

Package.onUse(function (api) {
    api.versionsFrom('METEOR@1.0.3.1')
    api.use('lodash');
    api.use('underscore-string-latest');
    api.use('q');
    api.use('define');

    api.addFiles('replace_underscore.js');
    api.addFiles('lib/chuck.js', 'client');
    api.addFiles('lib/chuck/audioContextService.js', 'client');
    api.addFiles('lib/chuck/helpers.js', 'client');
    api.addFiles('lib/chuck/instructions.js', 'client');
    api.addFiles('lib/chuck/lexer.js', 'client');
    api.addFiles('lib/chuck/logging.js', 'client');
    api.addFiles('lib/chuck/namespace.js', 'client');
    api.addFiles('lib/chuck/nodes.js', 'client');
    api.addFiles('lib/chuck/parser.js', 'client');
    api.addFiles('lib/chuck/parserService.js', 'client');
    api.addFiles('lib/chuck/scanner.js', 'client');
    api.addFiles('lib/chuck/types.js', 'client');
    api.addFiles('lib/chuck/ugen.js', 'client');
    api.addFiles('lib/chuck/vm.js', 'client');
    api.addFiles('lib/chuck/libs/math.js', 'client');
    api.addFiles('lib/chuck/libs/std.js', 'client');
    api.addFiles('lib/chuck/libs/stk.js', 'client');
    api.addFiles('lib/chuck/libs/ugens.js', 'client');
});
