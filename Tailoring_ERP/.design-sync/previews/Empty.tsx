import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "atelierhq-ui";
import { Plus, Ruler, ShoppingBag } from "lucide-react";

export function NoOrders() {
  return (
    <Empty className="w-full max-w-md border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShoppingBag />
        </EmptyMedia>
        <EmptyTitle>No orders yet</EmptyTitle>
        <EmptyDescription>
          Create your first order to start tracking garments from received to delivered.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button>
          <Plus /> New order
        </Button>
      </EmptyContent>
    </Empty>
  );
}

export function NoMeasurements() {
  return (
    <Empty className="w-full max-w-md border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Ruler />
        </EmptyMedia>
        <EmptyTitle>No measurements saved</EmptyTitle>
        <EmptyDescription>
          Add chest, waist, shoulder and sleeve measurements for Chinedu Okafor.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline">Add measurements</Button>
      </EmptyContent>
    </Empty>
  );
}
