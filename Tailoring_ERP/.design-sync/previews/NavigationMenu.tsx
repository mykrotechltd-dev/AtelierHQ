import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "atelierhq-ui";

export function Default() {
  return (
    <div style={{ padding: 16 }}>
      <NavigationMenu value="orders" onValueChange={() => {}}>
        <NavigationMenuList>
          <NavigationMenuItem value="orders">
            <NavigationMenuTrigger>Orders</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul style={{ width: 320, padding: 4, listStyle: "none", margin: 0 }}>
                <li>
                  <NavigationMenuLink href="#">
                    <div className="font-medium text-sm">All orders</div>
                    <p className="text-sm text-muted-foreground">Every order across the shop.</p>
                  </NavigationMenuLink>
                </li>
                <li>
                  <NavigationMenuLink href="#">
                    <div className="font-medium text-sm">In progress</div>
                    <p className="text-sm text-muted-foreground">Work currently with tailors.</p>
                  </NavigationMenuLink>
                </li>
                <li>
                  <NavigationMenuLink href="#">
                    <div className="font-medium text-sm">Ready for pickup</div>
                    <p className="text-sm text-muted-foreground">Completed and awaiting delivery.</p>
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem value="customers">
            <NavigationMenuTrigger>Customers</NavigationMenuTrigger>
            <NavigationMenuContent>
              <div style={{ width: 240, padding: 8 }} className="text-sm">Customer directory</div>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink href="#">Payments</NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}
