const webpack = require('../webpack-mini/webpack');
const options = require('./webpack.config');

const complier = webpack(options);

complier.run((err, stats) => {
  console.log('err', err);
  console.log('stats', stats)
})