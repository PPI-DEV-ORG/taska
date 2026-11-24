module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }]],
    // Gunakan babel-plugin css-interop langsung tanpa preset "nativewind/babel"
    // karena Expo 58 tidak menyertakan @babel/plugin-transform-react-jsx dan
    // jsxImportSource: "nativewind" sudah ditangani oleh babel-preset-expo.
    plugins: [require("react-native-css-interop/dist/babel-plugin").default],
  };
};
