import { Button, ButtonGroup, ButtonGroupText, ButtonGroupSeparator } from "atelierhq-ui";

export function OrderStatusFilter() {
  return (
    <div className="p-4">
      <ButtonGroup>
        <Button variant="secondary">All</Button>
        <Button variant="outline">In progress</Button>
        <Button variant="outline">Completed</Button>
      </ButtonGroup>
    </div>
  );
}

export function WithText() {
  return (
    <div className="p-4">
      <ButtonGroup>
        <ButtonGroupText>ORD-0042</ButtonGroupText>
        <Button variant="outline">Edit</Button>
        <ButtonGroupSeparator />
        <Button variant="outline">Print</Button>
      </ButtonGroup>
    </div>
  );
}

export function Vertical() {
  return (
    <div className="p-4">
      <ButtonGroup orientation="vertical">
        <Button variant="outline">Received</Button>
        <Button variant="outline">In progress</Button>
        <Button variant="outline">Delivered</Button>
      </ButtonGroup>
    </div>
  );
}
