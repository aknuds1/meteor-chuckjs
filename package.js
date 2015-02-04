Package.describe({
    summary: 'Interpreter for the ChucK music programming language',
    version: "0.3.0",
    name: 'aknudsen:chuckjs',
    git: 'https://github.com/aknuds1/chuck',
});

Package.onUse(function (api) {
    api.versionsFrom('METEOR@1.0.3.1')

    api.addFiles('lib/chuck.js', 'client');
});
