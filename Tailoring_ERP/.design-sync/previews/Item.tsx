import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "atelierhq-ui";
import { Ruler, Scissors } from "lucide-react";

export function CustomerRow() {
  return (
    <Item variant="outline" className="w-full max-w-md">
      <ItemMedia>
        <Avatar>
          <AvatarFallback>CO</AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Chinedu Okafor</ItemTitle>
        <ItemDescription>Chest 38 · Waist 32 · Shoulder 17</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button variant="outline" size="sm">
          View
        </Button>
      </ItemActions>
    </Item>
  );
}

export function TailorList() {
  const tailors = [
    ["Mr. Adeyemi", "Agbada set · ORD-0042", "In progress"],
    ["Mrs. Bello", "Ankara gown · ORD-0038", "Completed"],
    ["Adaeze Nwosu", "Aso-ebi · ORD-0045", "Received"],
  ];
  return (
    <ItemGroup className="w-full max-w-md">
      {tailors.map(([name, task, status], i) => (
        <div key={name}>
          {i > 0 && <ItemSeparator />}
          <Item>
            <ItemMedia variant="icon">
              <Scissors />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{name}</ItemTitle>
              <ItemDescription>{task}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Badge variant="secondary">{status}</Badge>
            </ItemActions>
          </Item>
        </div>
      ))}
    </ItemGroup>
  );
}

export function Variants() {
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <Item variant="muted" size="sm">
        <ItemMedia variant="icon">
          <Ruler />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Measurements saved</ItemTitle>
          <ItemDescription>Sleeve 24 · Chest 38</ItemDescription>
        </ItemContent>
      </Item>
      <Item variant="outline" size="sm">
        <ItemContent>
          <ItemTitle>Senator suit fitting</ItemTitle>
          <ItemDescription>Tomorrow, 10:00</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button size="sm">Confirm</Button>
        </ItemActions>
      </Item>
    </div>
  );
}
