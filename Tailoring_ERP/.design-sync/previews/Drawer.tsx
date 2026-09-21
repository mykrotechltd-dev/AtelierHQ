import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Input,
  Label,
} from "atelierhq-ui";

export function Default() {
  return (
    <Drawer open direction="bottom">
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Record payment</DrawerTitle>
          <DrawerDescription>
            ORD-0042 · Chinedu Okafor · balance ₦95,000
          </DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-4 px-4">
          <div className="grid gap-2">
            <Label htmlFor="drw-amount">Amount received (₦)</Label>
            <Input id="drw-amount" defaultValue="50,000" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="drw-method">Method</Label>
            <Input id="drw-method" defaultValue="Bank transfer" />
          </div>
        </div>
        <DrawerFooter>
          <Button>Save payment</Button>
          <Button variant="outline">Cancel</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
