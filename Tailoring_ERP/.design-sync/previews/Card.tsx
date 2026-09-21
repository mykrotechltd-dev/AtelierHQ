import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "atelierhq-ui";

export function OrderSummary() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>ORD-0042 · Agbada set</CardTitle>
        <CardDescription>Mr. Adeyemi · due 14 Oct</CardDescription>
        <CardAction>
          <Badge variant="secondary">In progress</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="font-medium">₦185,000</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Paid</span>
          <span className="font-medium">₦90,000</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Balance</span>
          <span className="font-medium text-destructive">₦95,000</span>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">Record payment</Button>
        <Button size="sm" variant="outline">
          View order
        </Button>
      </CardFooter>
    </Card>
  );
}

export function Stat() {
  return (
    <Card className="w-full max-w-xs">
      <CardHeader>
        <CardDescription>Outstanding this month</CardDescription>
        <CardTitle className="text-3xl">₦1,240,000</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        12 orders are waiting on a balance payment.
      </CardContent>
    </Card>
  );
}

export function Minimal() {
  return (
    <Card className="w-full max-w-sm">
      <CardContent className="text-sm">
        Fabric delivered — Ankara, 6 yards. Ready to cut.
      </CardContent>
    </Card>
  );
}
