import { Button, PageHeader } from "atelierhq-ui";
import { Plus } from "lucide-react";

export function TitleOnly() {
  return <PageHeader title="Dashboard" />;
}

export function WithDescription() {
  return (
    <PageHeader
      title="Customers"
      description="Everyone you sew for, with their measurements and order history."
    />
  );
}

export function WithActions() {
  return (
    <PageHeader
      title="Orders"
      description="Track every garment from fabric received to delivered."
    >
      <Button variant="outline">Export</Button>
      <Button>
        <Plus /> New order
      </Button>
    </PageHeader>
  );
}
