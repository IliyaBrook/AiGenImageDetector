import typescript from "@rollup/plugin-typescript";

const plugins = [typescript()];

export default [
  {
    plugins,
    input: "src/utils/defaultUtils/reload/initReloadServer.ts",
    output: {
      file: "src/utils/defaultUtils/reload/initReloadServer.js",
    },
    external: ["ws", "chokidar", "timers"],
  },
  {
    plugins,
    input: "src/utils/defaultUtils/reload/injections/script.ts",
    output: {
      file: "src/utils/defaultUtils/reload/injections/script.js",
    },
  },
  {
    plugins,
    input: "src/utils/defaultUtils/reload/injections/view.ts",
    output: {
      file: "src/utils/defaultUtils/reload/injections/view.js",
    },
  },
];
