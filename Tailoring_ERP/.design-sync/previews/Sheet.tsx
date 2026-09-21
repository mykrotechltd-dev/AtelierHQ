import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "atelierhq-ui";

function OrderBody() {
  return (
    <div className="grid gap-4 px-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Customer</span>
        <span className="font-medium">Chinedu Okafor</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Status</span>
        <Badge>In progress</Badge>
      </div>
      <div className="grid gap-2">
        <span className="text-muted-foreground">Items</span>
        <div className="flex items-center justify-between">
          <span>Agbada set (3-piece)</span>
          <span className="font-medium">₦120,000</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Senator suit</span>
          <span className="font-medium">₦65,000</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Total</span>
        <span className="font-semibold">₦185,000</span>
      </div>
    </div>
  );
}

export function Default() {
  return (
    <Sheet open>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Order ORD-0042</SheetTitle>
          <SheetDescription>Due Saturday, assigned to Tunde.</SheetDescription>
        </SheetHeader>
        <OrderBody />
        <SheetFooter>
          <Button>Mark completed</Button>
          <Button variant="outline">Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function LeftSide() {
  return (
    <Sheet open>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Order ORD-0042</SheetTitle>
          <SheetDescription>Due Saturday, assigned to Tunde.</SheetDescription>
        </SheetHeader>
        <OrderBody />
      </SheetContent>
    </Sheet>
  );
}
