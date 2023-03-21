import { defineConfig as __defineConfig, Options } from "tsup";

export function defineConfig(options: Options = {}) {
    return __defineConfig({
        entry: ["src/index.ts"],
        external: [],
        noExternal: [],
        platform: "node",
        format: ["esm", "cjs"],
        target: "es2021",
        skipNodeModulesBundle: true,
        clean: true,
        minify: false,
        splitting: false,
        keepNames: true,
        dts: true,
        sourcemap: true,
        esbuildPlugins: [],
        ...options
    });
}
