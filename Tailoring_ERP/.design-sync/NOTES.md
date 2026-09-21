# design-sync notes: AtelierHQ (Tailoring_ERP)

Target: Claude Design project "AtelierHQ Design System" (projectId in config.json). Shape: `package`, but this repo is an APP, not a published library, so the kit is built by us.

## How a sync runs (in order)
1. `npm ci` (repo lockfile). Toolchain seen: node 26, Vite 8, TS 6, Tailwind 4.3, React 19.
2. `npm run build:ds` -> `dist-ds/` (index.es.js, style.css, types/). Entry is `src/ds/index.ts` (curated: 54 `src/components/ui/*` modules + PageHeader + `toast`). **A new ui module is invisible to the kit until it is added to `src/ds/index.ts`** (unit-toggle is excluded on purpose: needs the app's measurement-unit context).
3. Stage the converter: copy `package-build.mjs package-validate.mjs package-capture.mjs resync.mjs lib storybook` from the skill dir into `.ds-sync/`; in `.ds-sync/` run `npm i esbuild ts-morph @types/react playwright@1.63.0` (playwright 1.63 pins chromium 1243, already cached in %LOCALAPPDATA%\ms-playwright).
4. Re-sync driver, from `Tailoring_ERP/`: `node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules --entry ./dist-ds/index.es.js --out ./ds-bundle [--remote .design-sync/.cache/remote-sync.json]`.
5. New exports need a category: run `node .design-sync/make-groups.mjs` (edit CATEGORIES first for a new module), else they land in group "general". `node .design-sync/make-icons.mjs` regenerates `src/ds/icons.ts` when the app starts using new lucide icons.

## Repo-specific facts
- 54 ui modules export 291 flat components (every part is its own export: DialogContent, CardHeader...). Previews are authored for the 55 root components + 4 tiny parts that only make sense in context (InputOTPSeparator, BreadcrumbEllipsis, PaginationEllipsis, SidebarMenuSkeleton). The other ~232 parts ship prop contracts + prompt docs and the floor card ("preview not yet authored") - authorable on any later sync.
- Categories (docsMap -> `.design-sync/groups/*.md` stubs): Actions, Forms, Overlays, Navigation, Data display, Feedback, Layout. docsMap has one entry per component (generated); this is the one legitimate "enumeration" - it exists only to regroup.
- Styling is ONE static Tailwind v4 stylesheet. Utilities exist only if used in `src/` or safelisted in `src/ds/ds.css` (`@source inline(...)`). Previews and the design agent must stick to classes in the compiled CSS; workers checked `.design-sync/.cache/available-classes.txt` (regenerate from `ds-bundle/_ds_bundle.css`). Classes added to the safelist after the workers hit misses: h-3, h-44/52/56/80, w-1/2 w-1/3 w-2/3 w-56, pt-24, divide-y, basis-1/2 basis-1/3, chart-1..5 and sidebar color tokens.
- Fonts: Cormorant Garamond (`font-sans`, headings) + DM Sans (`font-body`, default body) come from a REMOTE Google Fonts `@import` at the top of `src/ds/ds.css` (the app loads them via `<link>` in index.html). Nothing self-hosted -> `[FONT_REMOTE]` info. `--font-mono` names Geist Mono, which nothing loads.
- `extraEntries`: `recharts` (chart primitives on `window.AtelierHQ`; bundle grew ~2.1 -> 2.8 MB; `EXPORT_COLLISION` for `Tooltip`/`Label` is expected - the kit's own binding wins) and `./src/ds/icons.ts` (63 lucide icons as `<Name>Icon`, because the design agent has no bundler and cannot import lucide).
- `toast` is exported from the kit entry so the kit's Toaster and toast() share one sonner instance (a preview-side import of "sonner" is a different module instance and would never show).
- Card modes (config `overrides`): single + viewport + `primaryStory: "Default"` for overlays (Dialog, AlertDialog, Sheet, Drawer, Popover, HoverCard, Tooltip, DropdownMenu, ContextMenu, Menubar, Select, NavigationMenu, Sidebar, Toaster) - their previews MUST export a `Default` story; column for wide ones (Table, ChartContainer, Carousel, ResizablePanelGroup, Form, Field, InputGroup, Pagination, Tabs, Command).

## Preview authoring gotchas (learned from the 7 authoring batches)
- Previews must be deterministic: no `Date.now()`, argument-less `new Date()`, `Math.random()`, network images (use initials/tokens/gradients via inline style).
- Slider/Progress collapse without a width; ScrollArea needs an explicit height and `type="always"` to show its scrollbar; ResizablePanelGroup (react-resizable-panels v4) uses `orientation` and STRING sizes ("35%", bare numbers are px) plus an explicit height.
- Sidebar: use `collapsible="none"` inside `SidebarProvider className="min-h-0"` with an explicit inline height, else the inset stretches to the full viewport.
- Recharts pieces must be imported from `"atelierhq-ui"` (one instance); set `isAnimationActive={false}` on Bar/Area or the capture catches an animation mid-way.
- ContextMenu only opens on right-click: the preview dispatches a real `contextmenu` MouseEvent on the trigger 50ms after mount (genuine component, not a lookalike).
- Form previews need react-hook-form `useForm` (bundled into the preview, NOT on the kit global) - the conventions header tells the agent to build forms from Field/Input instead.
- Tooling: Bash heredocs containing non-ASCII (the naira sign, middle dot) or apostrophes broke in this environment; write preview files with the Write tool.
- Selected/pressed toggle state renders in the terracotta `accent` token - the kit's design, not a bug.
- Popover content has no gap between children by default (add spacing); its input autofocuses and shows selected text when opened (Radix focus behavior).

## Findings worth telling the app team (not fixed: it is their source)
- `Kbd` uses `font-sans`, which this theme maps to Cormorant Garamond, so key caps render in a serif. Probably wanted `font-body`.
- `AvatarGroup`'s default overlap slightly clips initials at size-8.
- `ItemHeader` / `ItemFooter` are not demonstrated in any Item preview.

## Known render warns (triaged, expected)
- `[FONT_REMOTE]` Cormorant Garamond / Cambria / Geist Mono / DM Sans: remote @import is present by design.
- `[EXPORT_COLLISION]` recharts `Tooltip`, `Label` vs the kit's own: the kit wins, intended.
- `[DTS_STYLE_SYSTEM]` filtering @types/react props: informational (React DOM props filtered; className/style/children/asChild/ref/id kept).
- `[GRID_OVERFLOW]` on Toaster, InputGroup, Pagination, Tabs, Command: resolved via `overrides` card modes (see above).

## Re-sync risks (what can silently go stale)
- Google Fonts are network-loaded at render time: an offline render falls back to serif/sans system fonts. Self-hosting the woff2 files (+ `cfg.extraFonts`) would remove the dependency.
- The utility vocabulary is frozen at build time: a new app screen using new classes does NOT make them available to designs unless they are in `src/` (then Tailwind picks them up) or the `ds.css` safelist.
- `src/ds/icons.ts` and `docsMap` are generated lists: new icons / new components need the generators re-run (see step 5).
- Previews are tied to component APIs (Sidebar collapsible, ResizablePanelGroup orientation/percent sizes, Select/Toast). A `radix-ui`, `react-resizable-panels`, `recharts`, `sonner` or `vaul` major bump may change what renders; the driver's spot-check will surface it.
- Verified ONLY in headless Chromium 1243 against the built bundle; not in the live Claude Design canvas until a human opens the project.
- Not authored: ~232 sub-part components (floor cards). `ItemHeader`/`ItemFooter` and `AvatarImage` states are not shown.
- The rebuild after editing `.design-sync/conventions.md` must be a fresh driver run (the README is stitched at build time).
