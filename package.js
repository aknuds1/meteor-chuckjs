Package.describe({
    summary: 'JavaScript (CoffeeScript) parser for the ChucK language'
});

Package.on_use(function (api) {
    api.use('q');
    api.use('underscore-string-latest');
    api.use('require');

    api.add_files('lib/chuck.js', 'client');
});