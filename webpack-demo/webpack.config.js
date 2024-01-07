const path = require('path');
const DonePlugin = require('../plugins/done-plugin');

module.exports = {
  mode: 'development',
  devtool: 'none',
  entry: './src/index.js',
  context: process.cwd(),
  module: {
    rules: [
      {
        test: /\.js/,
        use: [
          path.resolve(__dirname, '../loaders/loader-1.js'),
        ],
      },
    ],
  },
  plugins: [
    new DonePlugin(),
  ],
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, './dist'),
  },
}