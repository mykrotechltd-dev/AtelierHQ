import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSeparator, FieldSet, Input } from "atelierhq-ui";

export function CustomerMeasurements() {
  return (
    <div className="p-6" style={{ maxWidth: 480 }}>
      <FieldSet>
        <FieldLegend>Upper body measurements</FieldLegend>
        <FieldDescription>Enter all values in inches for Chinedu Okafor.</FieldDescription>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="chest">Chest</FieldLabel>
            <Input id="chest" defaultValue="38" />
          </Field>
          <Field>
            <FieldLabel htmlFor="waist">Waist</FieldLabel>
            <Input id="waist" defaultValue="32" />
          </Field>
          <FieldSeparator>Arms</FieldSeparator>
          <Field>
            <FieldLabel htmlFor="shoulder">Shoulder</FieldLabel>
            <Input id="shoulder" defaultValue="17" />
            <FieldDescription>Measured seam to seam across the back.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="sleeve">Sleeve</FieldLabel>
            <Input id="sleeve" defaultValue="24" />
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  );
}

export function WithError() {
  return (
    <div className="p-6" style={{ maxWidth: 480 }}>
      <Field data-invalid="true">
        <FieldLabel htmlFor="sleeve-err">Sleeve (inches)</FieldLabel>
        <Input id="sleeve-err" defaultValue="240" aria-invalid="true" />
        <FieldError>Sleeve length looks too long. Enter a value between 15 and 40.</FieldError>
      </Field>
    </div>
  );
}

export function Horizontal() {
  return (
    <div className="p-6" style={{ maxWidth: 480 }}>
      <Field orientation="horizontal">
        <FieldLabel htmlFor="phone">Phone</FieldLabel>
        <Input id="phone" defaultValue="+234 801 234 5678" />
      </Field>
    </div>
  );
}
