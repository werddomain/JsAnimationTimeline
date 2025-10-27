const path = require('path');

module.exports = {
  mode: 'development', // Use 'production' for minified builds
  entry: './src/JsTimeLine.ts',
  devtool: 'inline-source-map', // Ensures best source maps for debugging
  
  output: {
    filename: 'JsTimeLine.bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'JsTimeLine',
    libraryTarget: 'umd',
    clean: true, // Clean the dist folder before each build
  },
  
  resolve: {
    extensions: ['.ts', '.js'],
  },
  
  module: {
    rules: [
      // TypeScript Loader
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      // LESS/CSS Loaders
      {
        test: /\.less$/i,
        use: [
          'style-loader', // Injects styles into DOM
          'css-loader',   // Translates CSS into CommonJS
          'less-loader',  // Compiles LESS to CSS
        ],
      },
    ],
  },
  
  devServer: {
    static: {
      directory: path.join(__dirname), // Serve from root
    },
    compress: true,
    port: 9000,
    hot: true, // Enable hot module replacement
    watchFiles: ['src/**/*', 'index.html'], // Watch src and index.html
  },
};
