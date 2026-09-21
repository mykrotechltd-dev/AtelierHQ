import {
  Badge,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "atelierhq-ui";

const orders = [
  { no: "ORD-0042", customer: "Mr. Adeyemi", garment: "Agbada set", due: "14 Oct", status: "In progress", total: "₦185,000" },
  { no: "ORD-0043", customer: "Adaeze Nwosu", garment: "Ankara gown", due: "16 Oct", status: "Received", total: "₦72,000" },
  { no: "ORD-0044", customer: "Chinedu Okafor", garment: "Senator suit", due: "10 Oct", status: "Completed", total: "₦120,000" },
  { no: "ORD-0045", customer: "Mrs. Bello", garment: "Aso-ebi (6 pieces)", due: "02 Oct", status: "Delivered", total: "₦210,000" },
];

const variant = (s: string) =>
  s === "Completed" ? "default" : s === "Delivered" ? "outline" : "secondary";

export function OrdersTable() {
  return (
    <Table>
      <TableCaption>Recent orders this week</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Garment</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o) => (
          <TableRow key={o.no}>
            <TableCell className="font-medium">{o.no}</TableCell>
            <TableCell>{o.customer}</TableCell>
            <TableCell>{o.garment}</TableCell>
            <TableCell>{o.due}</TableCell>
            <TableCell>
              <Badge variant={variant(o.status)}>{o.status}</Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">{o.total}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={5}>Total billed</TableCell>
          <TableCell className="text-right tabular-nums">₦587,000</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

export function SelectedRow() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tailor</TableHead>
          <TableHead>Task</TableHead>
          <TableHead className="text-right">Pay</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">Tunde</TableCell>
          <TableCell>Cut agbada panels</TableCell>
          <TableCell className="text-right tabular-nums">₦8,000</TableCell>
        </TableRow>
        <TableRow data-state="selected">
          <TableCell className="font-medium">Ngozi</TableCell>
          <TableCell>Hand-finish Ankara gown</TableCell>
          <TableCell className="text-right tabular-nums">₦12,500</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Emeka</TableCell>
          <TableCell>Sew senator suit trousers</TableCell>
          <TableCell className="text-right tabular-nums">₦9,000</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
