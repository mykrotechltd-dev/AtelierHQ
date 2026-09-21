import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "atelierhq-ui";

export function ShopPolicies() {
  return (
    <Accordion type="single" collapsible defaultValue="deposit" className="w-full max-w-md">
      <AccordionItem value="fitting">
        <AccordionTrigger>How many fittings do I get?</AccordionTrigger>
        <AccordionContent>
          Every order includes two fittings: one after the first cut and one before final finishing.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="deposit">
        <AccordionTrigger>What deposit is required?</AccordionTrigger>
        <AccordionContent>
          We collect 50% upfront (for example ₦92,500 on a ₦185,000 agbada set). The balance is due at collection.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="alterations">
        <AccordionTrigger>Are alterations free?</AccordionTrigger>
        <AccordionContent>
          Adjustments within 14 days of delivery are free. Later changes are quoted per garment.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function MultipleOpen() {
  return (
    <Accordion type="multiple" defaultValue={["chest", "waist"]} className="w-full max-w-md">
      <AccordionItem value="chest">
        <AccordionTrigger>Upper body</AccordionTrigger>
        <AccordionContent>Chest 38 in, shoulder 17 in, sleeve 24 in.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="waist">
        <AccordionTrigger>Lower body</AccordionTrigger>
        <AccordionContent>Waist 32 in, hip 40 in, inseam 31 in.</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
