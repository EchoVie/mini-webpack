const Compiler = require('./Compiler')
const NodeEnvironmentPlugin = require('./node/NodeEnvironmentPlugin')
const WebpackOptionsApply = require('./WebpackOptionsApply')

const webpack = function (options) {
  // 1. 实力化 compiler 对象
  const compiler = new Compiler();
  compiler.options = options;

  // 2. 初始化 NodeEnvironmentPlugin（让compiler具有文件读写能力）
  new NodeEnvironmentPlugin().apply(compiler);

  // 3. 挂载所有plugins 插件至 compiler 对象身上
  if (options.plugins && Array.isArray(options.plugins)) {
    for (const plugins of options.plugins) {
      plugins.apply(compiler);
    }
  }

  // 4. 挂载所有 webpack 内置的插件（入口）
  new WebpackOptionsApply().process(options, compiler);

  // 5. 返回 compiler 对象
  return compiler;
}

module.exports = webpack;