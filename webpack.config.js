const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin')

module.exports = (env, argv) => ({
  // Plugin 코드와 UI 코드를 별도 엔트리로 번들
  entry: {
    code: './src/plugin/controller.ts',
    ui: './src/ui/index.tsx',
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },

  // Figma UI는 단일 HTML 파일이어야 하므로 JS를 인라인
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/ui/index.html',
      filename: 'ui.html',
      chunks: ['ui'],
      inject: 'body',
      cache: false,
    }),
    new HtmlInlineScriptPlugin(),
  ],

  // code.js는 HTML에 포함하지 않음 (별도 파일로 출력)
  // ui.js는 HTML에 인라인되므로 별도 파일 출력 불필요
  optimization: {
    minimize: argv.mode === 'production',
  },

  devtool: argv.mode === 'development' ? 'inline-source-map' : false,
})
