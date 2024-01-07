class SingleEntryPlugin {
  constructor(context, entry, name) {
    this.context = context
    this.entry = entry
    this.name = name
  }
  apply(compiler) {
    compiler.hooks.make.tapAsync('SingleEntryPlugin', (compilation, callback) => {
      const { context, entry, name } = this;

      console.log('make 钩子监听执行了')

      compilation.addEntry(context, entry, name, callback);
    })
  }
}

class EntryOptionPlugin {
  apply(complier) {
    // 挂载 entryOption 钩子
    complier.hooks.entryOption.tap('EntryOptionPlugin', (context, entry) => {
      // 挂载make钩子
      new SingleEntryPlugin(context, entry, 'main').apply(complier)
    })
  }
}

class WebpackOptionsApply {
  process(options, compiler) {
    // 挂载 entryOption 和 make 钩子
    new EntryOptionPlugin().apply(compiler)

    // 调用 entryOption 钩子
    compiler.hooks.entryOption.call(options.context, options.entry)
  }
}

module.exports = WebpackOptionsApply;