const fs = require('fs');

const existsSync = fs.existsSync;
const mkdirSync = fs.mkdirSync;

function tryExtensions(
  absoluteModulePath,
  extensions,
  modulePath,
  moduleDirName
) {
  // 自带后缀 会匹配到
  extensions.unshift('');

  for (let extension of extensions) {
    if (existsSync(absoluteModulePath + extension)) {
      return absoluteModulePath + extension;
    }
  };

  throw new Error(
    `No module, Error: Can't resolve ${modulePath} in  ${moduleDirName}`
  )
}

module.exports = {
  tryExtensions,
  existsSync,
  mkdirSync
}