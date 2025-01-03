const path = require('node:path');
const Mocha = require('mocha');
const glob = require('glob');

function run() {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((c, e) => {
    const testFiles = new glob.Glob('**/**.test.js', { cwd: testsRoot });
    const testFileStream = testFiles.stream();

    testFileStream.on('data', (file) => {
      // Add files to the test suite
      mocha.addFile(path.resolve(testsRoot, file));
    });
    testFileStream.on('error', (err) => {
      e(err);
    });
    testFileStream.on('end', () => {
      try {
        // Run the mocha test
        mocha.run((failures) => {
          if (failures > 0) {
            e(new Error(`${failures} tests failed.`));
          } else {
            c();
          }
        });
      } catch (err) {
        console.error(err);
        e(err);
      }
    });
  });
}

module.exports = {
  run,
};
