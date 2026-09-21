import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "atelierhq-ui";
import {
  BarChart3,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Scissors,
  Settings,
  ShoppingBag,
  Users,
  UserCog,
} from "lucide-react";

const main = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Orders", icon: ShoppingBag, badge: "12" },
  { label: "Customers", icon: Users },
  { label: "Workers", icon: UserCog },
  { label: "Tasks", icon: ClipboardList, badge: "5" },
];
const business = [
  { label: "Payments", icon: CreditCard },
  { label: "Reports", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];

export function Default() {
  return (
    <SidebarProvider className="min-h-0" style={{ height: 520 }}>
      <Sidebar collapsible="none" className="h-full">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Scissors className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-medium leading-none">AtelierHQ</span>
              <span className="text-xs text-muted-foreground">Bello and Sons Tailoring</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workshop</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {main.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton isActive={item.active}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {item.badge && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Business</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {business.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex flex-col px-2 py-1 text-sm">
            <span className="font-medium">Mrs. Bello</span>
            <span className="text-xs text-muted-foreground">Shop owner</span>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="p-6 text-sm text-muted-foreground">Dashboard content</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
