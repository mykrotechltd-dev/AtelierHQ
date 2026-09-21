import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "atelierhq-ui";
import { Plus, UserPlus, Wallet, Ruler } from "lucide-react";

export function Palette() {
  return (
    <Command className="border-border" style={{ width: 380, border: "1px solid", borderRadius: 8 }}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick actions">
          <CommandItem>
            <Plus /> New order <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <UserPlus /> Add customer <CommandShortcut>⌘K</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Wallet /> Record payment <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Customers">
          <CommandItem>
            <Ruler /> Chinedu Okafor
          </CommandItem>
          <CommandItem>
            <Ruler /> Adaeze Nwosu
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

export function NoResults() {
  return (
    <Command className="border-border" style={{ width: 380, border: "1px solid", borderRadius: 8 }}>
      <CommandInput placeholder="Search orders..." defaultValue="zzz" />
      <CommandList>
        <CommandEmpty>No orders match your search.</CommandEmpty>
      </CommandList>
    </Command>
  );
}
