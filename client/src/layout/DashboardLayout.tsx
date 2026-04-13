
import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ThemeToggle } from "../components/ThemeToggle";
import NieLogo from "../assets/NieLogo.png";
import {
  Menu,
  LayoutDashboard,
  Activity,
  Settings,
  X,
  ChevronRight,
  ChevronLeft,
  User,
  LogOut,
  FileText,
  Cpu,
  LineChart,
  Users,
  Radio,
  TrendingUp,
  BarChart,
} from "lucide-react";
import { ROUTES } from "../utils/constants";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DESKTOP_EXPANDED = 240;
const DESKTOP_COLLAPSED = 76;

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateMatch = () => setIsDesktop(mediaQuery.matches);
    updateMatch();
    mediaQuery.addEventListener("change", updateMatch);
    return () => mediaQuery.removeEventListener("change", updateMatch);
  }, []);

  const sidebarDesktopWidth = collapsed ? DESKTOP_COLLAPSED : DESKTOP_EXPANDED;
  const sidebarWidth = isDesktop ? sidebarDesktopWidth : 260;

  const handleLogout = async () => {
    await logout();
  };

  const navItems = [
    { to: ROUTES.DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
    { to: "/live-data", label: "Live Data", icon: Radio },
    { to: "/live-graph", label: "Live Graph", icon: TrendingUp },
    { to: "/sensor", label: "Recorded Data", icon: Activity },
    { to: "/bar-chart", label: "Recorded Graph", icon: BarChart },

    { to: "/reports", label: "Report Generation", icon: FileText },
    ...(user?.role === "ADMIN"
      ? [
        { to: "/devices", label: "Sensor Management", icon: Cpu },
        { to: "/users", label: "User Management", icon: Users }
      ]
      : []),
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  // Determine active state by matching pathname
  const isNavActive = (to: string) => {
    const targetPath = new URL(to, window.location.origin).pathname;
    return location.pathname === targetPath;
  };

  return (
    <div className="min-h-screen bg-background">
      {!isDesktop && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-900 text-white shadow-xl transition-all duration-300 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0`}
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="h-14 sm:h-16 border-b border-white/10 flex items-center px-3 sm:px-4 gap-2 sm:gap-3">
          {!collapsed && (
            <>

              <img
                src={NieLogo}
                alt="NIE"
                className="h-10 w-10 rounded-full object-cover flex-shrink-0"
              />
              <span className="text-lg font-semibold whitespace-nowrap">NIE</span>
            </>
          )}
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="ml-auto hidden lg:flex items-center justify-center h-9 w-9 rounded-full hover:bg-white/10 transition"
            aria-label="Toggle sidebar"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg:hidden h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/10 transition"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={() =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isNavActive(to)
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-white/5"
                } ${collapsed ? "justify-center" : ""}`
              }
            >
              <Icon className="h-5 w-5" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10" />
      </aside>

      {/* Header */}
      <header
        className="fixed top-0 h-14 sm:h-16 bg-background border-b border-border shadow-sm flex items-center justify-between px-3 sm:px-4 lg:px-6 z-30 transition-all duration-300 ease-in-out "
        style={
          isDesktop
            ? {
              left: `${sidebarDesktopWidth}px`,
              right: "0",
              width: `calc(100% - ${sidebarDesktopWidth}px)`,
              maxWidth: `calc(100vw - ${sidebarDesktopWidth}px)`,
            }
            : { left: "0", right: "0", width: "100%", maxWidth: "100vw" }
        }
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent transition lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative ml-auto flex items-center gap-2" ref={profileRef}>
          <ThemeToggle />
          <button
            onClick={() => setProfileOpen((prev) => !prev)}
            className="flex items-center gap-3 rounded-full px-2 py-1 hover:bg-accent transition"
          >
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-medium text-foreground">{user?.username}</span>
              <span className="w-full  text-xs text-muted-foreground text-center">{user?.role}</span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {user?.username?.[0]?.toUpperCase() || <User className="h-5 w-5" />}
            </div>
          </button>
          {profileOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-popover shadow-lg z-50 overflow-hidden"
              role="menu"
              aria-label="Profile menu"
            >
              <NavLink
                to="/settings"
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-accent text-left"
                onClick={() => setProfileOpen(false)}
              >
                <Settings className="h-4 w-4" />
                Account settings
              </NavLink>
              <button
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 text-left"
                onClick={() => {
                  setProfileOpen(false);
                  logout();
                }}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main
        className="pt-14 sm:pt-16 min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)] transition-all duration-300 ease-in-out overflow-x-hidden bg-background"
        style={
          isDesktop
            ? {
              marginLeft: `${sidebarDesktopWidth}px`,
              width: `calc(100% - ${sidebarDesktopWidth}px)`,
              maxWidth: `calc(100vw - ${sidebarDesktopWidth}px)`,
            }
            : {
              marginLeft: "0",
              width: "100%",
              maxWidth: "100vw",
            }
        }
      >
        <div className="px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-5 lg:py-6 w-full max-w-full overflow-x-hidden box-border">{children}</div>
      </main>
    </div>
  );
}


