import { esbuildPluginVersionInjector } from "esbuild-plugin-version-injector";
import { defineConfig } from "../../tsup.config";

export default defineConfig({ esbuildPlugins: [esbuildPluginVersionInjector()] });