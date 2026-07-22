module.exports = function modPow() {
  throw new Error(
    'react-native-modpow stub: native RSA modPow acceleration is not installed. ' +
      'node-forge\'s pure-JS BigInteger.modPow is used instead (see patches/react-native-androidtv-remote+*.patch).',
  );
};
