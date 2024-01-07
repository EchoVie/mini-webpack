const ejs = require('ejs');
const path = require('path');
const babylon = require('babylon');
const { SyncHook } = require('tapable');
const async = require('neo-async');
const NormalModuleFactory = require('./NormalModuleFactory');

class Chunk {
  constructor(entryModule) {
    this.entryModule = entryModule;
    this.name = entryModule.name;
    this.files = []; // 记录每个 chunk的文件信息
    this.modules = []; // 记录每个chunk所包含的 module
  }
}

class Parser {
  parse(source) {
    return babylon.parse(source, {
      sourceType: 'module',
      plugins: ['dynamicImport'] // 支持import动态导入
    })
  }
}

const parser = new Parser();

class Compilation {
  constructor(compiler) {
    this.compiler = compiler;
    this.context = compiler.context;
    this.options = compiler.options;
    // 让 compilation 具备文件的读写能力
    this.inputFileSystem = compiler.inputFileSystem;
    this.outputSystem = compiler.outputSystem;
    this.entries = [];
    this.modules = [];
    this.chunks = [];
    this.asserts = [];
    this.files = [];
    this.hooks = {
      succeedModule: new SyncHook(['module']),
      seal: new SyncHook(),
      beforeChunks: new SyncHook(),
      afterChunks: new SyncHook()
    }
  }

  addEntry(context, entry, name, callback) {
    // 绝对路径
    const absolutePath = path.posix.join(context, entry);
    const relativePath = './' + path.posix.relative(context, absolutePath);
  
    this.createModule(
      {
        parser,
        name,
        context,
        rawRequest: entry,
        resource: absolutePath,
        moduleId: relativePath
      },
      callback,
      (entryModule) => {
        this.entries.push(entryModule)
      },
    )
  }

  /**
   * 定义一个创建模块的方法，达到复用的目的
   * @param {*} data 创建模块时所需要的一些属性值 
   * @param {*} doAddEntry 可选参数，在加载入口模块的时候，将入口模块的id 写入 this.entries 
   * @param {*} callback 
   */
  createModule(data, callback, doAddEntry) {
    if (this.modules.some(item => item.moduleId === data.moduleId)) {
      return;
    }
    // 生成module对象
    const normalModuleFactory = new NormalModuleFactory();
    const module = normalModuleFactory.create(data);

    const afterBuild = (err, module) => {
      if (module.dependencies.length > 0) {
        this.processDependencies(module, (err) => {
          callback(err, module);
        })
      } else {
        callback(err, module)
      }
    }
    this.buildModule(module, afterBuild);
    if (doAddEntry) {
      doAddEntry(module)
    } else {
      this.modules.push(module);
    }
  }
  buildModule(module, callback) {
    // 读取源码 =》 转化 ast =》 处理 ast =》 生产源码
    module.build(this, (err) => {
      this.hooks.succeedModule.call(module)
      callback(err, module);
    })
  }
  processDependencies(module, callback) {
    // 01 当前的函数核心功能就是实现一个被依赖模块的递归加载
    // 02 加载模块的思想都是创建一个模块，然后想办法将被加载模块的内容拿进来?
    // 03 当前我们不知道 module 需要依赖几个模块， 此时我们需要想办法让所有的被依赖的模块都加载完成之后再执行 callback？【 neo-async 】
    const dependencies = module.dependencies;
    async.forEach(dependencies, (dependencies, done) => {
      this.createModule({
        parser,
        name: dependencies.name,
        context: dependencies.context,
        rawRequest: dependencies.rawRequest,
        moduleId: dependencies.moduleId,
        resource: dependencies.resource
      }, done)
    }, callback)
  }
  seal(callback) {
    this.hooks.seal.call();
    this.hooks.beforeChunks.call();

    for (const entryModule of this.entries) {
      const chunk = new Chunk(entryModule);
      this.chunks.push(chunk)

      chunk.modules = this.modules.filter(module => module.name === chunk.name);
    }

    this.hooks.afterChunks.call(this.chunks);
    // 生成代码内容
    this.createChunkAssets();
    callback();
  }
  createChunkAssets() {
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      const parseFileName = this.options.output.filename.replace('[name]', chunk.name)
      chunk.files.push(parseFileName);

      // 1. 获取模板文件的路径
      const tempPath = path.posix.join(__dirname, 'temp/main.ejs');
      // 2. 读取模块文件中的内容
      const tempCode = this.inputFileSystem.readFileSync(tempPath, 'utf8');
      // 3. 获取渲染函数
      const tempRender = ejs.compile(tempCode);
      // 4. 按 ejs 的语法渲染数据
      const source = tempRender({
        entryModuleId: chunk.entryModule.moduleId,
        modules: [chunk.entryModule, ...chunk.modules]
      })

      this.asserts[parseFileName] = source;
      this.files.push(parseFileName)
    }
  }
}

module.exports = Compilation;