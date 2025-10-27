const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env) => {
  const isProduction = env.production === true;
  
  return {
    mode: isProduction ? 'production' : 'development',
    entry: './src/JsTimeLine.ts',
    devtool: isProduction ? 'source-map' : 'inline-source-map',
    
    output: {
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'JsTimeLine',
        type: 'umd',
      },
      globalObject: 'this',
      clean: true,
    },
    
    resolve: {
      extensions: ['.ts', '.js', '.less', '.css'],
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
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            'less-loader',
          ],
        },
        // CSS Loaders
        {
          test: /\.css$/i,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
          ],
        },
      ],
    },
    
    plugins: [
      new HtmlWebpackPlugin({
        template: './index.html',
        filename: 'index.html',
        inject: 'body',
      }),
      ...(isProduction ? [
        new MiniCssExtractPlugin({
          filename: 'styles.[contenthash].css',
        }),
      ] : []),
    ],
    
    devServer: {
      static: {
        directory: path.join(__dirname, 'dist'),
      },
      compress: true,
      port: 9000,
      hot: true,
      watchFiles: ['src/**/*'],
      open: false,
    },
    
    optimization: {
      moduleIds: 'deterministic',
      runtimeChunk: 'single',
      splitChunks: {
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          styles: {
            name: 'styles',
            type: 'css/mini-extract',
            chunks: 'all',
            enforce: true,
          },
        },
      },
    },
  };
};
