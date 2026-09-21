// Run from the Tailoring_ERP dir. Regenerates src/ds/icons.ts from the lucide icons src/ imports.
// Generates src/ds/icons.ts from the lucide icons the app's source actually imports.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ERP = process.cwd().split("\\").join("/");

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const names = new Set();
for (const f of walk(join(ERP, "src")).filter((p) => /\.tsx?$/.test(p))) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/g)) {
    for (const part of m[1].split(",")) {
      const orig = part.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, "").trim();
      if (/^[A-Z][A-Za-z0-9]*$/.test(orig)) names.add(orig);
    }
  }
}
const icons = [...new Set([...names]
  .map((n) => (n.endsWith("Icon") ? n : `${n}Icon`)))]
  .sort();

const header = `// Icon vocabulary for design tools: the lucide icons AtelierHQ's own screens
// import, exposed on the kit's global (window.AtelierHQ.PlusIcon, ...) via
// cfg.extraEntries. A design agent consuming the bundle has no bundler, so it
// cannot \`import\` from "lucide-react" the way the app does. Every name ends in
// "Icon" so none can collide with a kit component (Calendar, Table, Command).
// Regenerate the list when the app starts using new icons.
`;
writeFileSync(
  join(ERP, "src/ds/icons.ts"),
  header + `export {\n${icons.map((i) => `  ${i},`).join("\n")}\n} from "lucide-react";\n`,
);
console.log(`${icons.length} icons:`, icons.join(" "));
