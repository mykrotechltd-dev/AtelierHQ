// Builds the design-system library that /design-sync compiles and uploads:
//
//   dist-ds/index.es.js   the kit's components (vite lib build, deps external)
//   dist-ds/style.css     compiled Tailwind theme + tokens + safelist
//   dist-ds/types/        .d.ts tree the converter reads prop contracts from
//
// Separate from `npm run build` (which writes dist/ for the app).
import { execSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist-ds");
const typesRoot = join(out, "types");

const run = (cmd) => execSync(cmd, { cwd: root, stdio: "inherit" });

rmSync(out, { recursive: true, force: true });

// 1. JS + CSS. Vite empties dist-ds/ itself, so this must run before tsc.
run("npx vite build -c vite.ds.config.ts");

// 2. Declarations for the curated entry and everything it reaches.
run("npx tsc -p tsconfig.ds.json");

// 3. tsc keeps the source's "@/..." path aliases verbatim in the emitted
//    .d.ts, which nothing outside this repo's tsconfig can resolve - the
//    converter's type checker would silently degrade those types to `any`.
//    Rewrite them relative, strip side-effect stylesheet imports, and add a
//    root index.d.ts (package.json "types") re-exporting the entry.
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

for (const file of walk(typesRoot).filter((f) => f.endsWith(".d.ts"))) {
  const before = readFileSync(file, "utf8");
  const after = before
    .replace(/^import\s+["'][^"']+\.css["'];?\r?\n/gm, "")
    .replace(/(["'])@\/([^"']+?)(?:\.tsx?)?\1/g, (_, quote, spec) => {
      let rel = relative(dirname(file), join(typesRoot, spec))
        .split(sep)
        .join("/");
      if (!rel.startsWith(".")) rel = `./${rel}`;
      return `${quote}${rel}${quote}`;
    });
  if (after !== before) writeFileSync(file, after);
}
writeFileSync(join(typesRoot, "index.d.ts"), 'export * from "./ds/index";\n');

for (const f of ["index.es.js", "style.css", "types/index.d.ts"]) {
  if (!existsSync(join(out, f))) {
    console.error(`build-ds: expected dist-ds/${f} was not produced`);
    process.exit(1);
  }
}
const kb = (f) => (statSync(join(out, f)).size / 1024).toFixed(0);
console.log(
  `build-ds: index.es.js ${kb("index.es.js")} KB, style.css ${kb("style.css")} KB, ` +
    `${walk(typesRoot).length} .d.ts files`,
);
