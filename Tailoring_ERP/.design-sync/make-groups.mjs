// Run from the Tailoring_ERP dir AFTER npm run build:ds and a converter build (needs ds-bundle/components/general or the current group dirs).
// Regenerates .design-sync/groups/*.md and cfg.docsMap so every kit export lands in a category.
// New ui module? add it to CATEGORIES below first.
// Generates .design-sync/groups/*.md category stubs + cfg.docsMap so the 291
// flat shadcn exports land in categories instead of one "general" group.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ERP = process.cwd().split("\\").join("/");
const CATEGORIES = {
  Actions: ["button", "button-group", "toggle", "toggle-group"],
  Forms: [
    "input", "input-group", "input-otp", "textarea", "checkbox", "radio-group",
    "select", "slider", "switch", "label", "field", "form", "calendar",
  ],
  Overlays: [
    "dialog", "alert-dialog", "sheet", "drawer", "popover", "hover-card",
    "tooltip", "dropdown-menu", "context-menu", "menubar", "command",
  ],
  Navigation: ["breadcrumb", "navigation-menu", "pagination", "tabs", "sidebar"],
  "Data display": [
    "table", "card", "badge", "avatar", "accordion", "collapsible", "carousel",
    "chart", "item", "kbd", "progress",
  ],
  Feedback: ["alert", "empty", "error-state", "skeleton", "spinner", "sonner"],
  Layout: ["aspect-ratio", "scroll-area", "separator", "resizable", "page-header"],
};
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const moduleOf = {};
for (const [cat, mods] of Object.entries(CATEGORIES)) for (const m of mods) moduleOf[m] = cat;

const typesDir = join(ERP, "dist-ds/types/components/ui");
const nameToCat = {};
const uncategorized = [];
for (const f of readdirSync(typesDir).filter((n) => n.endsWith(".d.ts"))) {
  const mod = f.replace(/\.d\.ts$/, "");
  const cat = moduleOf[mod];
  const src = readFileSync(join(typesDir, f), "utf8");
  const names = new Set();
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g))
    for (const part of m[1].split(",")) {
      const n = part.trim().split(/\s+as\s+/).pop();
      if (/^[A-Z][A-Za-z0-9]*$/.test(n)) names.add(n);
    }
  for (const m of src.matchAll(/export\s+declare\s+(?:function|const|class)\s+([A-Z][A-Za-z0-9]*)/g)) names.add(m[1]);
  if (!cat) { if (names.size) uncategorized.push(mod); continue; }
  for (const n of names) nameToCat[n] = cat;
}
nameToCat.PageHeader = "Layout";
if (uncategorized.length) console.error("UNCATEGORIZED modules:", uncategorized);

// every built component must be covered
// Components live in components/<group>/<Name>/ (flat "general" on a first
// build, category folders once docsMap is applied) - collect names from all.
const built = readdirSync(join(ERP, "ds-bundle/components")).flatMap((g) =>
  readdirSync(join(ERP, "ds-bundle/components", g)),
);
const missing = built.filter((n) => !nameToCat[n]);
const extra = Object.keys(nameToCat).filter((n) => !built.includes(n));
console.log(`components built: ${built.length}, mapped: ${Object.keys(nameToCat).length}`);
console.log("missing (built but unmapped):", missing);
console.log("extra (mapped but not a built component):", extra);

mkdirSync(join(ERP, ".design-sync/groups"), { recursive: true });
for (const cat of Object.keys(CATEGORIES))
  writeFileSync(join(ERP, `.design-sync/groups/${slug(cat)}.md`), `---\ncategory: ${cat}\n---\n`);

const cfgPath = join(ERP, ".design-sync/config.json");
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
cfg.docsMap = Object.fromEntries(
  built.filter((n) => nameToCat[n]).sort().map((n) => [n, `.design-sync/groups/${slug(nameToCat[n])}.md`]),
);
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
const counts = {};
for (const n of built) counts[nameToCat[n]] = (counts[nameToCat[n]] ?? 0) + 1;
console.log("per category:", counts);
