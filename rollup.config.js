import babel from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';
import url from '@rollup/plugin-url';
import pkg from './package.json';

export default {
  input: 'src/index.js',
  output: [
    {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
    },
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
    },
  ],
  external: [
    /^@babel.*/,
    /^@date-io\/.*/,
    /^@material-ui\/.*/,
    /^@openimis.*/,
    'classnames',
    'clsx',
    'history',
    /^lodash.*/,
    'moment',
    'prop-types',
    /^react.*/,
    /^redux.*/,
  ],
  plugins: [
    json(),
    // Embed PDF logos in the built module instead of relying on runtime URLs.
    url({ include: ['**/*.png'], limit: Infinity }),
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'runtime',
    }),
  ],
};
