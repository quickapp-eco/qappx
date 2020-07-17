const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const terser = require('terser');
const rollup = require('rollup');
const configs = require('./configs');

fs.mkdirSync('dist');

build(Object.keys(configs).map((key) => configs[key]));

function build(builds) {
  let built = 0;
  const total = builds.length;
  const next = () => {
    buildEntry(builds[built]).then(() => {
      // eslint-disable-next-line no-plusplus
      built++;
      if (built < total) {
        next();
      }
    }).catch(logError);
  };

  next();
}

function buildEntry({ input, output }) {
  const { file } = output;
  const isProd = /min\.js$/.test(file);
  return rollup.rollup(input)
    .then((bundle) => bundle.generate(output))
    .then(({ output: [{ code }] }) => {
      if (isProd) {
        const minified = terser.minify(code, {
          toplevel: true,
          output: {
            ascii_only: true,
          },
          compress: {
            pure_funcs: ['makeMap'],
          },
        }).code;
        return write(file, minified, true);
      }
      return write(file, code);
    });
}

function write(dest, code, zip) {
  return new Promise((resolve, reject) => {
    function report(extra) {
      // eslint-disable-next-line no-console
      console.log(`${blue(path.relative(process.cwd(), dest))} ${getSize(code)}${extra || ''}`);
      resolve();
    }

    fs.writeFile(dest, code, (err) => {
      if (err) return reject(err);
      if (zip) {
        // eslint-disable-next-line no-shadow
        zlib.gzip(code, (err, zipped) => {
          if (err) return reject(err);
          report(` (gzipped: ${getSize(zipped)})`);
        });
      } else {
        report();
      }
    });
  });
}

function getSize(code) {
  return `${(code.length / 1024).toFixed(2)}kb`;
}

function logError(e) {
  console.error(e);
}

function blue(str) {
  return `\x1b[1m\x1b[34m${str}\x1b[39m\x1b[22m`;
}
