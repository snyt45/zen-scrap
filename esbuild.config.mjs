import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { copyFileSync } from "fs";

const prod = process.argv[2] === "production";

const PLUGIN_DIR = process.env.OBSIDIAN_PLUGIN_DIR || "";

const copyPlugin = {
  name: "copy-to-obsidian",
  setup(build) {
    build.onEnd(() => {
      if (PLUGIN_DIR) {
        try {
          copyFileSync("main.js", `${PLUGIN_DIR}/main.js`);
          copyFileSync("styles.css", `${PLUGIN_DIR}/styles.css`);
        } catch (e) {
          console.error("Copy failed:", e.message);
        }
      }
    });
  },
};

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  plugins: [copyPlugin],
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
