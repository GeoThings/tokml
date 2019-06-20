const library = require('@neutrinojs/library');
const jest = require('@neutrinojs/jest');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')

module.exports = {
  options: {
    root: __dirname,
  },
  use: [
    library({
      name: 'tokml',
      babel: {
        presets: ['@babel/typescript']
      }
    }),
    jest(),
    neutrino => {
      neutrino.config.plugin('fork-ts-checker').use(ForkTsCheckerWebpackPlugin, [{
        checkSyntacticErrors: true,
        tslint: true
      }]);
      neutrino.config.resolve.extensions.add('.ts')
      neutrino.config.module.rule('compile').test(/\.(wasm|mjs|jsx|js|ts)$/)
    }
  ],
};
