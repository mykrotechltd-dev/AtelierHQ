import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
} from "atelierhq-ui";

export function NavLoading() {
  return (
    <SidebarProvider className="min-h-0">
      <Sidebar collapsible="none" className="h-auto w-64 rounded-md border">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workshop</SidebarGroupLabel>
            <SidebarMenu>
              {[0, 1, 2, 3, 4].map((i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}

export function WithoutIcons() {
  return (
    <SidebarProvider className="min-h-0">
      <Sidebar collapsible="none" className="h-auto w-64 rounded-md border">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Customers</SidebarGroupLabel>
            <SidebarMenu>
              {[0, 1, 2].map((i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuSkeleton />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
