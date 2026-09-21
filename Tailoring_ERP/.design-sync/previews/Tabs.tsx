import { Tabs, TabsContent, TabsList, TabsTrigger } from "atelierhq-ui";

export function CustomerTabs() {
  return (
    <Tabs defaultValue="measurements" style={{ width: 420 }}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="measurements">Measurements</TabsTrigger>
        <TabsTrigger value="orders">Orders</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="text-sm text-muted-foreground">
        Chinedu Okafor, customer since March. 6 orders, last delivered agbada set.
      </TabsContent>
      <TabsContent value="measurements" className="text-sm text-muted-foreground">
        Chest 38 in · Waist 32 in · Shoulder 17 in · Sleeve 24 in
      </TabsContent>
      <TabsContent value="orders" className="text-sm text-muted-foreground">
        ORD-0042 senator suit, in progress.
      </TabsContent>
      <TabsContent value="payments" className="text-sm text-muted-foreground">
        ₦185,000 total, ₦100,000 paid, ₦85,000 outstanding.
      </TabsContent>
    </Tabs>
  );
}

export function OrderStatusTabs() {
  return (
    <Tabs defaultValue="in-progress" style={{ width: 420 }}>
      <TabsList>
        <TabsTrigger value="received">Received</TabsTrigger>
        <TabsTrigger value="in-progress">In progress</TabsTrigger>
        <TabsTrigger value="completed">Completed</TabsTrigger>
      </TabsList>
      <TabsContent value="received" className="text-sm text-muted-foreground">3 new orders.</TabsContent>
      <TabsContent value="in-progress" className="text-sm text-muted-foreground">
        5 orders with tailors, 2 due this week.
      </TabsContent>
      <TabsContent value="completed" className="text-sm text-muted-foreground">4 ready for pickup.</TabsContent>
    </Tabs>
  );
}
