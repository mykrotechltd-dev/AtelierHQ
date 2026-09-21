import { useEffect } from "react";
import { Toaster, toast } from "atelierhq-ui";

// Toaster renders nothing until toast() fires. `toast` is exported by the kit
// itself (same sonner instance as Toaster), so the real component shows here.
export function Default() {
  useEffect(() => {
    const id = window.setTimeout(() => {
      toast.success("Payment recorded", {
        description: "₦90,000 received for ORD-0042 · Mr. Adeyemi",
        duration: Infinity,
      });
      toast.error("Couldn't save the fitting", {
        description: "Pick a time that isn't already booked.",
        duration: Infinity,
      });
    }, 50);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div style={{ height: 260, width: 420 }}>
      <Toaster position="top-center" expand visibleToasts={3} />
    </div>
  );
}
