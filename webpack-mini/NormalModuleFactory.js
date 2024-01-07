const path = require('path');
const types = require('@babel/types');
const generator = require('@babel/generator').default;
const traverse = require('@babel/traverse').default;
const { tryExtensions } = require('./shared/index');

class NormalModule {
  constructor(data) {
    this.context = data.context;
    this.name = data.name;
    this.moduleId = data.moduleId;
    this.rawRequest = data.rawRequest;
    this.parser = data.parser;
    this.resource = data.resource;
    this._source; // 存放某个模块的源代码
    this._ast; // 存放某个模板源代码对应的 ast
    this.dependencies = []; // 定义一个空数组用于保存被依赖加载的模块信息
  }

  build(compilation, callback) {
    /**
     * 01 从文件中读取到将来需要被加载的 module 内容
     * 02 如果当前不是 js 模块则需要 Loader 进行处理，最终返回 js 模块 
     * 03 上述的操作完成之后就可以将 js 代码转为 ast 语法树
     * 04 当前 js 模块内部可能又引用了很多其它的模块，因此我们需要递归完成 
     * 05 前面的完成之后，我们只需要重复执行即可
    */
    
    this.doBuild(compilation, (err) => {
      this.handleLoader(compilation)
      // 1. 源文件转化为 ast
      this._ast = this.parser.parse(this._source);

      // 2. 处理 ast
      traverse(this._ast, {
        // CallExpression 为 require对应的节点类型
        CallExpression: (nodePath) => {
          // 当前 AST 节点
          const node = nodePath.node;

          if (node.callee.name === 'require') {
            // './title' 
            const requirePath = node.arguments[0].value;
            const moduleDirName = path.posix.dirname(this.resource);
            const fullPath = path.posix.resolve(moduleDirName, requirePath);
            const extensions = compilation.options.resolve?.extensions ?? ['.js', '.json', '.node'];
            const depResource = tryExtensions(
              fullPath,
              extensions,
              requirePath,
              moduleDirName
            )

            // 当前模块id './src/title.js'
            const depModuleId = './' + path.posix.relative(this.context, depResource)

            // 记录当前被依赖模块的信息，方便后面递归加载
            this.dependencies.push({
              name: this.name,
              context: this.context,
              rawRequest: requirePath,
              moduleId: depModuleId,
              resource: depResource
            })

            node.callee = types.identifier('__webpack_require__');
            node.arguments = [types.stringLiteral(depModuleId)]
          }
        }
      })

      // 3. ast重新转化成源码
      let { code } = generator(this._ast);
      this._source = code;
      callback(err);
    })
  }

  // 根据文件路径 读取文件资源, 并赋值给 _source
  doBuild(compilation, callback) {
    compilation.inputFileSystem.readFile(
      this.resource,
      'utf8',
      (err, source) => {
        this._source = source;
        callback();
      }
    )
  }

  handleLoader(compilation) {
    const matchLoaders = [];
    const rules = compilation.options.module.rules || [];
    rules.forEach((loader) => {
      const testRule = loader.test;
      if (testRule.test(this.moduleId)) {
        if (loader.loader) {
          matchLoaders.push(loader)
        } else {
          matchLoaders.push(...loader.use);
        }
      }
    })
    for (let i = matchLoaders.length - 1; i >= 0; i--) {
      const loaderFn = require(matchLoaders[i]);
      this._source = loaderFn(this._source)
    }
  }
}

class NormalModuleFactory {
  create(data) {
    return new NormalModule(data)
  }
}

module.exports = NormalModuleFactory;