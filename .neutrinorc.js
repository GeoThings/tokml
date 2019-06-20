const library = require('@neutrinojs/library');
const jest = require('@neutrinojs/jest');

module.exports = {
  options: {
    root: __dirname,
  },
  use: [
    library({
      name: 'tokml'
    }),
    jest(),
  ],
};
