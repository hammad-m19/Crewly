module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for WatermelonDB model decorators (@field, @relation, etc.)
      ['@babel/plugin-proposal-decorators', { legacy: true }],
    ],
  };
};

