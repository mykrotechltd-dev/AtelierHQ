import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Label } from "atelierhq-ui";

// Open dropdown of garment types.
export function Default() {
  return (
    <div className="flex flex-col gap-2 p-6" style={{ width: 300 }}>
      <Label>Garment type</Label>
      <Select defaultOpen defaultValue="senator">
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose a garment" />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="agbada">Agbada</SelectItem>
          <SelectItem value="senator">Senator suit</SelectItem>
          <SelectItem value="ankara">Ankara gown</SelectItem>
          <SelectItem value="aso-ebi">Aso-ebi</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function Placeholder() {
  return (
    <div className="p-6" style={{ width: 300 }}>
      <Select>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose a garment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="agbada">Agbada</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
