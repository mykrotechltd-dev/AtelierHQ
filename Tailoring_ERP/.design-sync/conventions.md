# AtelierHQ kit: conventions for building with it

**Setup.** Load React, then `styles.css`, then `_ds_bundle.js`; everything is on `window.AtelierHQ`. No provider is needed for styling: every token is a CSS variable on `:root` (warm ivory `background`, deep navy `primary`, terracotta `accent`). Dark mode: put class `dark` on any ancestor (`<div class="dark">`). Body text is DM Sans by default; add `font-sans` for display headings (Cormorant Garamond).

**Wrappers that ARE required**
- `Tooltip`: one `<TooltipProvider>` somewhere above it.
- `Sidebar`, `SidebarMenu*` and friends: inside `<SidebarProvider>`. For a static layout use `<Sidebar collapsible="none">` and give the provider `className="min-h-0"` plus an explicit height.
- Toasts: mount `<Toaster />` once, then call `window.AtelierHQ.toast.success("Saved")`.
- Forms: build them from `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription`, `FieldError` with plain controlled `Input`s. `Form` / `FormField` need react-hook-form's `useForm`, which is not on the global.

**Styling idiom: Tailwind utility classes over semantic tokens, from ONE static stylesheet.** Only classes present in `_ds_bundle.css` exist; a class that isn't there renders unstyled. Read that file before styling, don't invent classes. Guaranteed families:
- Spacing: `p px py pt pb pl pr m mx my mt mb ml mr gap gap-x gap-y space-x space-y` with `0 0.5 1 1.5 2 2.5 3 4 5 6 8 10 12 16`, e.g. `p-6 gap-4 mx-auto`.
- Layout: `flex grid flex-col flex-row flex-wrap flex-1 items-center justify-between w-full h-full min-h-screen relative absolute`, `grid-cols-{1..6}` (also `sm:` `md:` `lg:`), `hidden` / `block` with breakpoint prefixes.
- Size: `w-{4,5,6,8,10,12,16,20,24,32,40,48,56,60,64,72,80,96}`, `w-1/2 w-1/3 w-2/3`, `h-{3,4,5,6,8,10,12,16,20,24,32,40,44,48,52,56,64,72,80}`, `size-{3,4,5,6,8,10,12}`, `max-w-{xs..7xl}`.
- Type: `text-{xs,sm,base,lg,xl,2xl,3xl,4xl,5xl}`, `font-{light,normal,medium,semibold,bold}`, `truncate`, `text-center`.
- Color (as `bg-`, `text-`, `border-`): `background foreground card card-foreground popover muted muted-foreground primary primary-foreground secondary secondary-foreground accent accent-foreground destructive success warning info border input ring chart-1..chart-5 sidebar sidebar-foreground sidebar-accent sidebar-border`. Example: `bg-card text-foreground border border-border`, `text-muted-foreground`. Never hard-code hex.
- Shape: `rounded rounded-md rounded-lg rounded-xl rounded-full`, `shadow shadow-sm shadow-md`, `border border-t border-b`.

**Icons.** You can't `import` lucide, so the 63 lucide icons AtelierHQ's screens use are on the global with an `Icon` suffix: `const { PlusIcon, SearchIcon, ScissorsIcon, WalletIcon } = window.AtelierHQ;` then `<PlusIcon className="size-4" />`. Others: `UsersIcon SettingsIcon TruckIcon RulerIcon ChevronDownIcon XIcon CheckIcon Trash2Icon`, all ending in `Icon`. Buttons size their own child icons, so `<Button><PlusIcon /> New order</Button>` just works.

**Charts.** recharts primitives (`BarChart Bar LineChart Line AreaChart Area XAxis YAxis CartesianGrid`) are on the same global as `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`. Give `ChartContainer` a fixed height and set `isAnimationActive={false}` on `Bar` / `Area`.

**Where the truth lives.** Styling: `_ds_bundle.css` (reached through `styles.css`). Per-component API: `components/<group>/<Name>/<Name>.d.ts`; usage and examples: `<Name>.prompt.md`. Components are flat parts (`Card`, `CardHeader`, `CardTitle`, `CardContent`): compose them, never restyle divs.

**One idiomatic build.**
```jsx
const { PageHeader, Card, CardHeader, CardTitle, CardContent, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Badge, Button, PlusIcon } = window.AtelierHQ;

function Orders() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Orders" description="Every garment from fabric received to delivered.">
        <Button><PlusIcon /> New order</Button>
      </PageHeader>
      <Card>
        <CardHeader><CardTitle>In progress</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell>ORD-0042</TableCell><TableCell>Mr. Adeyemi</TableCell><TableCell><Badge variant="secondary">In progress</Badge></TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```
