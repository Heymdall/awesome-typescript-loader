# The best TypeScript loader for Webpack

[![Join the chat at https://gitter.im/s-panferov/awesome-typescript-loader](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/s-panferov/awesome-typescript-loader?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Build Status](https://travis-ci.org/s-panferov/awesome-typescript-loader.svg?branch=master)](https://travis-ci.org/s-panferov/awesome-typescript-loader)

## Installation

```
npm install awesome-typescript-loader --save-dev
```

## Differences between [`ts-loader`](https://github.com/TypeStrong/ts-loader)

`awesome-typescript-loader` loader was created mostly to speed-up compilation in my own projects.
Some of them are quite big and I wanted to have full control on how my files are compiled. There are three major points:

1) atl has first-class integration with Babel and enables caching possibilities. This can be useful for those who use Typescript with Babel.
When `useBabel` and `useCache` flags are enabled, typescript's emit will be transpiled with Babel and cached.
So next time if source file (+environment) has the same checksum we can totally skip typescript's and babel's transpiling.
This significantly reduces build time in this scenario.

2) atl is able to fork type-checker and emitter to a separate process, which also speeds-up some development scenarios (e.g. react with react-hot-loader)
So your webpack compilation will end earlier and you can explore compiled version in your browser while your files are typechecked.

## Configuration

1. Add `.ts` as a resolvable extension.
2. Configure all files with a `.ts` extension to be handled by `awesome-typescript-loader`.

**webpack.config.js**

```javascript
// `CheckerPlugin` is optional. Use it if you want async error reporting.
// We need this plugin to detect a `--watch` mode. It may be removed later
// after https://github.com/webpack/webpack/issues/3460 will be resolved.
const { CheckerPlugin } = require('awesome-typescript-loader')

module.exports = {

  // Currently we need to add '.ts' to the resolve.extensions array.
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },

  // Source maps support ('inline-source-map' also works)
  devtool: 'source-map',

  // Add the loader for .ts files.
  module: {
    loaders: [
      {
        test: /\.tsx?$/,
        loader: 'awesome-typescript-loader'
      }
    ]
  },
  plugins: [
      new CheckerPlugin()
  ]
};
```

After that, you will be able to build TypeScript files with webpack.

## tsconfig.json

You can use the tsconfig.json file to configure your compiler and loader:

```
{
    "compilerOptions": {
        "noImplicitAny": true,
        "removeComments": true
    },
    "awesomeTypescriptLoaderOptions": {
        /* ... */
    }
}
```

## Supported TypeScript

`awesome-typescript-loader@2.x` aims to support only `typescript@2.x` and `webpack@2x`, if you need old compilers please use
`1.x` or `0.x` versions.

## Advanced path resolution in TypeScript 2.0

If you want to use new `paths` and `baseUrl` feature of TS 2.0 please include `TsConfigPathsPlugin`.
This feature is available only for `webpack@2.1`.

```
var TsConfigPathsPlugin = require('awesome-typescript-loader').TsConfigPathsPlugin;

resolve: {
    plugins: [
        new TsConfigPathsPlugin(/* { tsconfig, compiler } */)
    ]
}
```

## Loader options

### silent *(boolean) (default=false)*

No logging from the checker. Please note that this option disables async error reporting because
this option bans `console.log()` usage.

### compiler *(string) (default='typescript')*

Allows use of TypeScript compilers other than the official one. Must be
set to the NPM name of the compiler, e.g. *ntypescript* or the path to a package folder.
Note that the compiler must be installed in **your** project. You can also use
nightly versions.

### useTranspileModule (boolean) (default=false)*

Use fast `transpileModule` emit mode. Disables automatically when you set `declaration: true`.

### instance *(string) (default='at-loader')*

Allows the use of several TypeScript compilers with different settings in one app. Override `instance` to initialize another instance.

### configFileName *(string) (default='tsconfig.json')*

Specifies the path to a TS config file. This is useful when you have multiple config files. This setting is useless *inside* a TS config file.

### transpileOnly *(boolean) (default=true)*

Use this setting to disable type checking.

### ignoreDiagnostics *(number[]) (default=[])*

You can squelch certain TypeScript errors by specifying an array of [diagnostic codes](https://github.com/Microsoft/TypeScript/blob/master/src/compiler/diagnosticMessages.json) to ignore.
For example, you can transpile [stage 1 properties](https://github.com/jeffmo/es-class-fields-and-static-properties) from `*.js` using `"ignoreDiagnostics": [8014]`.

### useBabel *(boolean) (default=false)*

Invoke Babel to transpile files. Useful with ES6 target. Please see `useCache` option
which can improve warm-up time.

### babelCore *(string) (default=undefined)*

Override the path used to find `babel-core`. Useful if `node_modules` is installed in a non-standard place or webpack is being invoked from a directory not at the root of the project.

### babelOptions *(object) (default=null)*

Use this option to pass some options to Babel (e.g. presets). Please note that
[`.babelrc` file](https://babeljs.io/docs/usage/babelrc/) is more universal way to do this.

### useCache *(boolean) (default=false)*

Use internal file cache. This is useful with Babel, when processing takes a long time to complete. Improves warm-up time.

### usePrecompiledFiles *(boolean) (default=false)*

Use pre-compiled files if any. Files must be named as `{filename}.js` and `{filename}.map`.

### cacheDirectory *(string) (default='.awcache')*

Directory when cache is stored.

## Compiler options

You can pass compiler options inside loader query string or in tsconfig file.
