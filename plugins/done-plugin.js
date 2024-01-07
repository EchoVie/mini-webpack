class DonePlugin {
  apply(compiler) {
    // 调用 Compiler Hook 注册额外逻辑
    compiler.hooks.emit.tap('Plugin Done', (compilation) => {
      console.log(compilation, 'compilation 对象');
    });
  }
}

module.exports = DonePlugin;
