// Generates src/theme-colors.generated.css from the shared palette
// (@kowloon/design/tokens/palette.json) — the single source of truth shared
// with the mobile app. Runs on predev/prebuild. Do not edit the generated CSS
// by hand.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const palettePath = join(
  __dirname,
  "../node_modules/@kowloon/design/tokens/palette.json"
);
const outPath = join(__dirname, "../src/theme-colors.generated.css");

const palette = JSON.parse(readFileSync(palettePath, "utf8"));

// Map a palette key to its CSS custom-property name. Post-type colors use the
// `--post-color-*` prefix on the web; everything else uses `--color-*`.
const cssVar = (key) =>
  key.startsWith("post-")
    ? `--post-color-${key.slice("post-".length)}`
    : `--color-${key}`;

const decls = (obj, keys) =>
  keys.map((k) => `    ${cssVar(k)}: ${obj[k]};`).join("\n");

const lightKeys = Object.keys(palette.light);
// Dark block only needs the tokens whose value differs from light (overrides).
const darkKeys = lightKeys.filter((k) => palette.dark[k] !== palette.light[k]);

const css = `/* AUTO-GENERATED from @kowloon/design/tokens/palette.json — do not edit.
   Run \`npm run gen:theme\` (also runs on predev/prebuild). */
[data-theme="kowloon"] {
${decls(palette.light, lightKeys)}
}

/* "System" dark mode fallback — active when no theme is injected. */
@media (prefers-color-scheme: dark) {
  [data-theme="kowloon"] {
${decls(palette.dark, darkKeys)}
  }
}
`;

writeFileSync(outPath, css);
console.log(`theme: wrote ${outPath} (${lightKeys.length} light, ${darkKeys.length} dark overrides)`);
