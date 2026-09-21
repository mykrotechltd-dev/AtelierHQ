import { ScrollArea, Separator } from "atelierhq-ui";

const orders = [
  ["ORD-0042", "Chinedu Okafor", "Agbada set"],
  ["ORD-0041", "Adaeze Nwosu", "Ankara gown"],
  ["ORD-0040", "Mr. Adeyemi", "Senator suit"],
  ["ORD-0039", "Mrs. Bello", "Aso-ebi"],
  ["ORD-0038", "Chinedu Okafor", "Senator suit"],
  ["ORD-0037", "Adaeze Nwosu", "Aso-ebi"],
  ["ORD-0036", "Mr. Adeyemi", "Agbada set"],
  ["ORD-0035", "Mrs. Bello", "Ankara gown"],
  ["ORD-0034", "Chinedu Okafor", "Kaftan"],
  ["ORD-0033", "Adaeze Nwosu", "Ankara gown"],
  ["ORD-0032", "Mr. Adeyemi", "Senator suit"],
  ["ORD-0031", "Mrs. Bello", "Aso-ebi"],
];

export function RecentOrders() {
  return (
    <ScrollArea type="always" className="h-64 w-72 rounded-lg border border-border bg-card">
      <div className="p-4">
        <h4 className="mb-3 text-sm font-medium text-foreground">Recent orders</h4>
        {orders.map(([no, name, item]) => (
          <div key={no}>
            <div className="flex flex-col py-2 text-sm">
              <span className="font-medium text-foreground">{no} · {item}</span>
              <span className="text-muted-foreground">{name}</span>
            </div>
            <Separator />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

const rows = [["Chest", 38], ["Waist", 32], ["Shoulder", 17], ["Sleeve", 24], ["Neck", 15], ["Hip", 40], ["Inseam", 31], ["Thigh", 23], ["Bicep", 13], ["Wrist", 7]];

export function MeasurementRows() {
  return (
    <ScrollArea type="always" className="h-40 w-64 rounded-lg border border-border bg-card">
      <div className="p-4">
        {rows.map(([label, v]) => (
          <div key={label} className="flex items-center justify-between py-1 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium tabular-nums text-foreground">{v} in</span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
