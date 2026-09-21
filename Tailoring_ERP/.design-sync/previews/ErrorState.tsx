import {
  Button,
  ErrorState,
  ErrorStateContent,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
} from "atelierhq-ui";
import { CloudOff, RotateCw } from "lucide-react";

export function OrdersFailed() {
  return (
    <ErrorState className="w-full max-w-md">
      <ErrorStateHeader>
        <ErrorStateMedia />
        <ErrorStateTitle>Could not load orders</ErrorStateTitle>
        <ErrorStateDescription>
          Something went wrong while fetching your orders. Check your connection and try again.
        </ErrorStateDescription>
      </ErrorStateHeader>
      <ErrorStateContent>
        <Button>
          <RotateCw /> Try again
        </Button>
      </ErrorStateContent>
    </ErrorState>
  );
}

export function IconVariant() {
  return (
    <ErrorState className="w-full max-w-md">
      <ErrorStateHeader>
        <ErrorStateMedia variant="icon">
          <CloudOff />
        </ErrorStateMedia>
        <ErrorStateTitle>Customer list unavailable</ErrorStateTitle>
        <ErrorStateDescription>
          We could not reach the server. Your saved measurements are safe.
        </ErrorStateDescription>
      </ErrorStateHeader>
      <ErrorStateContent>
        <Button variant="outline">Retry</Button>
      </ErrorStateContent>
    </ErrorState>
  );
}
