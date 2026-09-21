import { Alert, AlertDescription, AlertTitle } from "atelierhq-ui";
import { CircleAlert, Wallet } from "lucide-react";

export function Default() {
  return (
    <div className="w-full max-w-md">
      <Alert>
        <Wallet />
        <AlertTitle>Balance outstanding</AlertTitle>
        <AlertDescription>
          ORD-0042 has ₦85,000 left to pay before delivery.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function Destructive() {
  return (
    <div className="w-full max-w-md">
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Payment failed</AlertTitle>
        <AlertDescription>
          The ₦185,000 card payment for Mr. Adeyemi was declined. Try another card.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function TitleOnly() {
  return (
    <div className="w-full max-w-md">
      <Alert>
        <Wallet />
        <AlertTitle>Fitting scheduled for Friday</AlertTitle>
      </Alert>
    </div>
  );
}
