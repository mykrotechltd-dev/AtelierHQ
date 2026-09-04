import { FrontBodiceDashboard } from "@/components/patterns/FrontBodiceDashboard";

// Standalone bodice-drafting playground — not tied to a specific order or
// saved customer measurement (that flow lives at /patterns/[orderItemId]).
// FrontBodiceDashboard renders its own bg-cream/p-6 wrapper, which stacks
// with this layout's <main className="p-6">; the extra padding is a minor,
// intentionally-accepted cosmetic tradeoff rather than reaching into an
// already-verified component to shave it off.
export default function PatternlabPage() {
  return <FrontBodiceDashboard />;
}
