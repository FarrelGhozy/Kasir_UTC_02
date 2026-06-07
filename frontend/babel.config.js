module.exports = {
  presets: [
    [require('../backend/node_modules/@babel/preset-env'), {
      targets: { node: 'current' },
      modules: 'commonjs'
    }]
  ]
};
