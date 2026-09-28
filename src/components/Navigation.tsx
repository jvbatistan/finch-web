"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logout } from "@/lib/auth";
import {
  X,
  Home,
  CreditCard,
  PieChart,
  Sparkles,
  TrendingUp,
  Calendar,
  Settings,
  User,
  LogOut,
  Hammer,
  Wallet,
  Landmark,
  CircleDollarSign,
  ClipboardCheck,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home, enabled: true },
  { href: "/transactions", label: "Transações", icon: CreditCard, enabled: true },
  { href: "/payments", label: "Pagamentos", icon: CircleDollarSign, enabled: true },
  { href: "/financial-hygiene", label: "Higiene financeira", icon: ClipboardCheck, enabled: true },
  { href: "/accounts", label: "Contas", icon: Landmark, enabled: true },
  { href: "/suggestions", label: "Sugestões", icon: Sparkles, enabled: true },
  { href: "/categories", label: "Categorias", icon: PieChart, enabled: true },
  { href: "/cards", label: "Cartões", icon: Wallet, enabled: true },
  { href: "", label: "Investimentos", icon: TrendingUp, enabled: false },
  { href: "", label: "Planejamento", icon: Calendar, enabled: false },
  { href: "/settings", label: "Configurações", icon: Settings, enabled: true },
];

type NavigationProps = {
  isMobileOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

export function Navigation({
  isMobileOpen = false,
  onClose,
  isCollapsed: controlledCollapsed,
  onCollapsedChange,
}: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed ?? internalCollapsed;

  function setIsCollapsed(nextValue: boolean | ((current: boolean) => boolean)) {
    const nextCollapsed = typeof nextValue === "function" ? nextValue(isCollapsed) : nextValue;
    setInternalCollapsed(nextCollapsed);
    onCollapsedChange?.(nextCollapsed);
  }

  async function handleLogout() {
    await logout();
    onClose?.();
    router.replace("/login");
  }

  const renderNavLinks = (collapsed = false) => (
    <div className="space-y-1">
      {navItems.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        const isDisabled = !item.enabled;

        if (isDisabled) {
          return (
            <div
              key={item.label}
              className={[
                "group flex rounded-lg py-3 text-neutral-400",
                collapsed ? "justify-center px-2" : "items-start gap-3 px-4",
              ].join(" ")}
              aria-disabled="true"
              title={collapsed ? `${item.label} - Em construção` : undefined}
            >
              <div className={collapsed ? "flex items-center justify-center" : "flex items-start gap-3"}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-400">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>

                {!collapsed && (
                  <div className="min-w-0">
                  <span className="text-sm">{item.label}</span>
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                      <Hammer className="h-3 w-3" />
                      Em construção
                    </span>
                  </div>
                </div>
                )}
              </div>
            </div>
          );
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onClose}
            title={collapsed ? item.label : undefined}
            className={[
              "group flex items-center rounded-lg py-3 transition-colors",
              collapsed ? "justify-center px-2" : "gap-3 px-4",
              active
                ? "bg-blue-50 font-medium text-blue-600"
                : "text-neutral-700 hover:bg-neutral-50",
            ].join(" ")}
          >
            <div
              className={[
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                active
                  ? "bg-transparent text-blue-600"
                  : "bg-transparent text-neutral-500",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>

            {!collapsed && <span className="text-sm">{item.label}</span>}
          </Link>
        );
      })}
    </div>
  );

  const profileActive = pathname === "/profile";

  return (
    <>
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 hidden shrink-0 border-r border-neutral-200 bg-white transition-[width] duration-300 lg:block",
          isCollapsed ? "w-[76px]" : "w-60",
        ].join(" ")}
      >
        <div className="flex items-center justify-end border-b border-neutral-100 p-3">
          <button
            type="button"
            onClick={() => setIsCollapsed((current) => !current)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
            aria-label={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        <div className="p-3">{renderNavLinks(isCollapsed)}</div>
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            aria-label="Fechar menu"
          />

          <aside className="relative h-full w-[18.5rem] max-w-[85vw] border-r border-neutral-200 bg-white shadow-xl">
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <p className="text-[2rem] font-bold leading-none text-neutral-900">Menu</p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100"
                aria-label="Fechar menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-t border-neutral-100 p-3">{renderNavLinks(false)}</div>
            <div className="mt-2 border-t border-neutral-100 px-3 pt-4">
              <Link
                href="/profile"
                onClick={onClose}
                className={[
                  "flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                  profileActive
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "text-neutral-700 hover:bg-neutral-50",
                ].join(" ")}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg">
                  <User className="h-5 w-5" />
                </div>
                <span className="text-sm">Perfil</span>
              </Link>
              <Link
                href="/settings"
                onClick={onClose}
                className={[
                  "flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                  pathname === "/settings"
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "text-neutral-700 hover:bg-neutral-50",
                ].join(" ")}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400">
                  <Settings className="h-5 w-5" />
                </div>
                <span className="text-sm">Configurações</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-rose-600 transition hover:bg-rose-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-500">
                  <LogOut className="h-5 w-5" />
                </div>
                <span className="text-sm">Sair</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
