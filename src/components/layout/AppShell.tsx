"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FolderTree, LogOut, Menu, PanelLeftClose, WalletCards, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/app/actions";

type AppShellProps = {
  children: React.ReactNode;
  userName: string;
  currentMonth: string;
};

const navItems = [
  { href: "/app/cashflow", label: "Fluxo de Caixa", icon: BarChart3 },
  { href: "/app/categories", label: "Categorias", icon: FolderTree },
];

export function AppShell({ children, userName, currentMonth }: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sidebar = (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-[76px]" : "w-64",
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <WalletCards className="size-5" />
        </div>
        {!collapsed ? <span className="text-lg font-semibold tracking-tight">My Finance</span> : null}
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition hover:scale-[1.01] hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                active && "bg-sidebar-accent text-sidebar-accent-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className="size-4" />
              {!collapsed ? item.label : null}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-sidebar-border p-3">
        <Button
          type="button"
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className="hidden w-full justify-start md:flex"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          <PanelLeftClose className={cn("size-4", collapsed && "rotate-180")} />
          {!collapsed ? "Recolher" : null}
        </Button>
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className={cn("w-full text-destructive hover:text-destructive", !collapsed && "justify-start")}
            title="Sair"
          >
            <LogOut className="size-4" />
            {!collapsed ? "Sair" : null}
          </Button>
        </form>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-dvh bg-background">
      <div className="hidden md:block">{sidebar}</div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative h-full w-72">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setDrawerOpen((value) => !value)}
              aria-label={drawerOpen ? "Fechar menu" : "Abrir menu"}
            >
              {drawerOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
            <div>
              <p className="text-xs text-muted-foreground">{currentMonth}</p>
              <h1 className="truncate text-base font-semibold">My Finance</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">Sessao ativa</p>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="icon-sm" aria-label="Sair">
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
