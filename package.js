Package.describe({
  summary: 'Interpreter for the ChucK music programming language',
  version: "0.1.4",
  name: 'aknudsen:chuckjs',
  git: "https://github.com/aknuds1/chuck",
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@0.9.3');
  api.addFiles('chuck.js', 'client');
});

// Package.onTest(function(api) {
//   api.use('tinytest');
//   api.use('aknudsen:chuckjs');
//   api.addFiles('aknudsen:chuckjs-tests.js');
// });
