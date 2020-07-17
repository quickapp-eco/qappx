module.exports = function fn(api) {
  api.cache(true);
  return {
    presets: ['@babel/preset-env'],
  };
};
