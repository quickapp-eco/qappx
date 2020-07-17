const path = require('path');
const buble = require('@rollup/plugin-buble');
const replace = require('@rollup/plugin-replace');
const { version } = require('../package.json');

const resolve = (_path) => path.resolve(__dirname, '../', _path);

const configs = {
  commonjs: {
    input: resolve('src/index.js'),
    file: resolve('dist/qappx.common.js'),
    format: 'cjs',
  },
  esm: {
    input: resolve('src/index.esm.js'),
    file: resolve('dist/qappx.esm.js'),
    format: 'es',
  },
};

function genConfig(opts) {
  const config = {
    input: {
      input: opts.input,
      plugins: [
        replace({
          __VERSION__: version,
        }),
        buble(),
      ],
    },
    output: {
      file: opts.file,
      format: opts.format,
      name: 'qappx',
    },
  };
  return config;
}

function mapValues(obj, fn) {
  const res = {};
  Object.keys(obj).forEach((key) => {
    res[key] = fn(obj[key], key);
  });
  return res;
}

module.exports = mapValues(configs, genConfig);
