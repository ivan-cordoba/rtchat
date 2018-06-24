module.exports = {
  entry: __dirname + '/client/src/index.jsx',
  resolve: {
    extensions: [
      '.js',
      '.jsx',
    ],
  },
  module: {
    rules: [
      {
        test: [/\.jsx$/],
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['env', 'react'],
        }
      }
    ]
  },
   output: {
    filename: 'app.js',
    path: __dirname + '/client/dist'
  }
};
