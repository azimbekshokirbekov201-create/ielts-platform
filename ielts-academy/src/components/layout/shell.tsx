"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Headphones,
  BookOpen,
  PenLine,
  Mic,
  ClipboardList,
  GraduationCap,
  ChartNoAxesCombined,
  Settings,
  ChevronDown,
  ArrowUpRight,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  Sparkles,
  Bell,
  Search,
  ChevronRight,
  Command,
} from "lucide-react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useApp, useResource } from "@/features/academy-context";
import { api, type Row } from "@/lib/api";
import { translations } from "@/data/content";
import { Modal, Tooltip } from "@/components/ui/primitives";
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="IELTS Academy home">
      <span className="brand-icon">
        <BookOpen size={small ? 20 : 23} strokeWidth={2.3} />
      </span>
      <span>
        IELTS<span className="brand-light"> Academy</span>
        <small aria-hidden="true">YOUR NEXT CHAPTER</small>
      </span>
    </Link>
  );
}
const navigation = [
  { key: "dashboard", path: "/dashboard", icon: LayoutDashboard },
  { key: "listening", path: "/practice/listening", icon: Headphones },
  { key: "reading", path: "/practice/reading", icon: BookOpen },
  { key: "writing", path: "/practice/writing", icon: PenLine },
  { key: "speaking", path: "/practice/speaking", icon: Mic },
  { key: "mock", path: "/mock-exams", icon: ClipboardList },
  { key: "courses", path: "/courses", icon: GraduationCap },
  { key: "progress", path: "/progress", icon: ChartNoAxesCombined },
] as const;
export function Shell({
  route,
  children,
}: {
  route: string;
  children: React.ReactNode;
}) {
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState(false);
  const { me, theme, lang, setLang, setTheme, run, refresh } = useApp();
  const session = me
    ? {
        name: me.profile.display_name,
        role: me.roles.includes("ADMIN")
          ? "admin"
          : me.roles.includes("TEACHER")
            ? "teacher"
            : "student",
      }
    : null;
  const inbox = useResource<Record<string, Row[]>>("dashboard");
  const preferences = ({
    theme,
    lang,
  }: {
    theme?: "light" | "dark";
    lang?: "en" | "uz" | "ru";
  }) => {
    if (theme) void setTheme(theme);
    if (lang) setLang(lang);
  };
  const logout = () =>
    void run(async () => {
      await api("auth/logout", "POST", {});
      await refresh();
      router.replace("/login");
    });
  const t = translations[lang];
  const router = useRouter();
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const title = navigation.find((n) => n.path === route)?.key;
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand small />
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <button
          className="workspace-switch"
          onClick={() => router.push("/settings")}
        >
          <span className="workspace-avatar">A</span>
          <span>
            Personal workspace
            <small>{session?.role}</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map((n, i) => (
            <div key={n.key}>
              {i === 1 && <p className="nav-label">PRACTICE & LEARN</p>}
              {i === 6 && <div className="nav-divider" />}
              <Link
                onClick={() => setMobile(false)}
                className={`nav-link ${route === n.path ? "active" : ""}`}
                href={n.path}
                aria-current={route === n.path ? "page" : undefined}
              >
                <n.icon size={19} />
                {t[n.key]}
                {n.key === "mock" && <span className="nav-new">NEW</span>}
              </Link>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <span className="spark-box">
              <Sparkles size={18} />
            </span>
            <h4>A little more ambition?</h4>
            <p>Explore what’s next for your IELTS journey.</p>
            <Link href="/courses">
              Explore courses <ArrowUpRight size={15} />
            </Link>
          </div>
          {me?.roles.some((role) => ["TEACHER", "ADMIN"].includes(role)) && (
            <Link className="nav-link" href="/teacher">
              <GraduationCap size={19} />
              {t.teacher}
            </Link>
          )}
          {me?.roles.includes("ADMIN") && (
            <Link className="nav-link" href="/admin">
              <Command size={19} />
              {t.admin}
            </Link>
          )}
          <Link
            className={`nav-link ${route === "/settings" ? "active" : ""}`}
            href="/settings"
          >
            <Settings size={19} />
            {t.settings}
          </Link>
          <div className="sidebar-user">
            <span className="avatar">{session?.name?.slice(0, 1) ?? "A"}</span>
            <span>
              {session?.name ?? ""}
              <small>{me?.email}</small>
            </span>
            <Tooltip label={t.logout}>
              <button
                className="icon-button"
                aria-label={t.logout}
                onClick={() => {
                  logout();
                }}
              >
                <LogOut size={16} />
              </button>
            </Tooltip>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {title
                ? t[title]
                : route === "/teacher"
                  ? t.teacher
                  : route === "/admin"
                    ? t.admin
                    : route === "/onboarding"
                      ? "Your learning profile"
                      : t.settings}
            </strong>
          </div>
          <div className="top-actions">
            <button
              className="search-button"
              onClick={() => setSearch(true)}
              aria-label="Search platform"
            >
              <Search size={16} />
              <span>Search platform</span>
              <kbd aria-hidden="true">⌘ K</kbd>
            </button>
            <Tooltip label="Toggle theme">
              <button
                className="icon-button"
                aria-label="Toggle theme"
                onClick={() =>
                  preferences({ theme: theme === "light" ? "dark" : "light" })
                }
              >
                {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </Tooltip>
            <Dropdown.Root>
              <Dropdown.Trigger
                className="language-button"
                aria-label={`Interface language ${lang.toUpperCase()}`}
              >
                {lang.toUpperCase()}
                <ChevronDown size={12} />
              </Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content className="dropdown" sideOffset={10}>
                  {(["en", "uz", "ru"] as const).map((l) => (
                    <Dropdown.Item
                      key={l}
                      onSelect={() => preferences({ lang: l })}
                    >
                      {l === "en"
                        ? "English"
                        : l === "uz"
                          ? "O‘zbekcha"
                          : "Русский"}{" "}
                      {l === lang ? "✓" : ""}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() => setNotifications(true)}
            >
              <Bell size={19} />
            </button>
            <Link
              href="/settings"
              className="avatar small-avatar"
              aria-label="Profile settings"
            >
              {session?.name?.slice(0, 1) ?? "A"}
            </Link>
          </div>
        </header>
        <main id="main" className="page-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>© 2026 IELTS Academy</span>
          <span>Small steps. Remarkable possibilities.</span>
          <Link href="/settings">Preferences</Link>
        </footer>
      </div>
      <Modal
        open={search}
        onOpenChange={setSearch}
        title="Find your next step"
        description="Search practice skills, courses, and your workspace."
      >
        <input
          autoFocus
          className="input"
          placeholder="Try reading or courses…"
          aria-label="Search pages"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="search-results">
          {navigation
            .filter((n) =>
              `${n.key} ${t[n.key]}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((n) => (
              <Link href={n.path} key={n.key} onClick={() => setSearch(false)}>
                <n.icon size={18} />
                {t[n.key]}
                <ArrowUpRight size={15} />
              </Link>
            ))}
        </div>
      </Modal>
      <Modal
        open={notifications}
        onOpenChange={setNotifications}
        title="Your learning inbox"
        description="Assignments from your teachers."
      >
        {inbox.data?.assignments.length ? (
          inbox.data.assignments.map((row) => (
            <div className="notification-item" key={row.id}>
              <span className="skill-icon orange">
                <PenLine size={20} />
              </span>
              <div>
                <h4>{row.title}</h4>
                <p>{String(row.due_date || "")}</p>
                <Link
                  href="/dashboard"
                  onClick={() => setNotifications(false)}
                  className="text-link"
                >
                  View assignments →
                </Link>
              </div>
            </div>
          ))
        ) : (
          <p className="notice">No assignments yet.</p>
        )}
      </Modal>
    </div>
  );
}
