import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "atelierhq-ui";

// Overlay: rendered open so the card shows the dialog itself.
export function AddCustomer() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add customer</DialogTitle>
          <DialogDescription>
            Save their details now — measurements can be added after the first
            fitting.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="dlg-name">Full name</Label>
            <Input id="dlg-name" placeholder="e.g. Chinedu Okafor" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dlg-phone">Phone</Label>
            <Input id="dlg-phone" placeholder="0803 000 0000" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Save customer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Confirm() {
  return (
    <Dialog open>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Mark order as delivered?</DialogTitle>
          <DialogDescription>
            ORD-0042 will move to Delivered and the customer's balance will be
            locked.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Not yet</Button>
          <Button>Mark delivered</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
