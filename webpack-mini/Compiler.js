const {
  SyncHook,
  SyncBailHook,
  AsyncSeriesHook,
  AsyncParallelHook
} = require('tapable');
const path = require('path');
const NormalModuleFactory = require('./NormalModuleFactory')
const Compilation = require('./Compilation')
const { existsSync, mkdirSync } = require('./shared/index');
const { debug } = require('console');

class Stats {
  constructor(compilation) {
    this.entries = compilation.entries;
    this.modules = compilation.modules;
    this.chunks = compilation.chunks;
    this.files = compilation.files;
  }

  toJSON() {
    return this
  }
}

class Compiler {
  constructor(context) {
    this.context = context;
    this.hooks = {
      done: new AsyncSeriesHook(['stats']),
      entryOption: new SyncBailHook(['context', 'entry']),

      beforeRun: new AsyncSeriesHook(['compiler']),
      run: new AsyncSeriesHook(['compiler']),

      thisCompilation: new SyncHook(['compilation', 'params']),
      compilation: new SyncHook(['compilation', 'params']),

      beforeCompilation: new AsyncSeriesHook(['params']),
      compile: new SyncHook(['params']),
      make: new AsyncParallelHook(['compilation']),
      afterCompile: new AsyncSeriesHook(['compilation']),

      // 输出 asset 到 output 目录之前执行 (写入文件之前)
      emit: new AsyncSeriesHook(['compilation'])
    }
  }

  // 1. 触发 callAsync 钩子
  // 2. 创建 dist
  // 3. 在目录创建完成之后执行文件的写操作
  emitAssets(compilation, callback) {
    this.hooks.emit.callAsync(compilation, (err) => {
      const outputPath = this.options.output.path;
      // 创建 dist 文件夹
      if (!existsSync(outputPath)) {
        mkdirSync(outputPath)
      }

      // 将assets中的文件 写入文件系统
      const asserts = compilation.asserts;
  
      for (let file in asserts) {
        const source = asserts[file];
        // path.posix 会兼容 window系统
        const targetPath = path.posix.join(outputPath, file);
  
        this.outputFileSystem.writeFileSync(targetPath, source, 'utf8')
      }
  
      callback(err)
    })
  }

  run(callback) {
    console.log('run 方法执行了')

    const onCompiled = (err, compilation) => {
      // 在文件系统中写入文件
      this.emitAssets(compilation, err => {
        // 文件系统写入文件 完成后 调用callback
        let stats = new Stats(compilation) // 包含compilation信息的对象
        callback(err, stats);
      })
    }

    this.hooks.beforeRun.callAsync(this, (err) => {
      this.hooks.run.callAsync(this, (err) => { 
        this.compile(onCompiled)
      })
    })
  }
  
  compile(callback) {
    const moduleHandler = {
      normalModuleFactory: new NormalModuleFactory()
    }

    this.hooks.beforeCompilation.callAsync(moduleHandler, (err) => {
      this.hooks.compile.call(moduleHandler);
      const compilation = this.newCompilation(moduleHandler);

      // 调用 compilation.addEntry(context, entry, 'main', callback);
      this.hooks.make.callAsync(compilation, (err) => { 
        compilation.seal((err) => {
          this.hooks.afterCompile.callAsync(compilation, (err) => {
            callback(err, compilation)
          })
        })
      })
    })
  }

  newCompilation(moduleHandler) {
    const compilation = new Compilation(this);
    this.hooks.thisCompilation.call(compilation, moduleHandler);
    this.hooks.compilation.call(compilation, moduleHandler);
    return compilation
  }
}

module.exports = Compiler;