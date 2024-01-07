const fs = require('fs');

class NodeEnvironmentPlugin {
  constructor() {}

  apply(compiler) {
    compiler.inputFileSystem = fs;
    compiler.outputFileSystem = fs;
  }
}

module.exports = NodeEnvironmentPlugin;