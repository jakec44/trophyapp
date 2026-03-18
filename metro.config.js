const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Load .env.local first so it overrides .env (Metro needs EXPO_PUBLIC_* for the bundle; works even with plain npx expo start)
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const config = getDefaultConfig(__dirname);

// Prevent Metro from resolving into api/ (separate Node server)
// Resolve @firebase/* so Metro can find them (firebase package re-exports use bare specifiers)
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: false,
  extraNodeModules: {
    ...config.resolver?.extraNodeModules,
    '@firebase/firestore': path.dirname(require.resolve('@firebase/firestore/package.json')),
    '@firebase/app': path.dirname(require.resolve('@firebase/app/package.json')),
  },
  blockList: [
    ...(Array.isArray(config.resolver?.blockList) ? config.resolver.blockList : []),
    /api[/\\]node_modules[/\\].*/,
  ],
};

module.exports = config;
