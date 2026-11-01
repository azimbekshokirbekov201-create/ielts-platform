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
import { useAcademy } from "@/store/use-academy";
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
  const { session, theme, lang, preferences, logout } = useAcademy();
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
          onClick={() => router.push("/login")}
        >
          <span className="workspace-avatar">A</span>
          <span>
            Personal workspace
            <small>{session ? `${session.role} demo` : "Student demo"}</small>
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
            <Link href="/#pricing">
              Explore plans <ArrowUpRight size={15} />
            </Link>
          </div>
          {session?.role === "teacher" && (
            <Link className="nav-link" href="/teacher">
              <GraduationCap size={19} />
              {t.teacher}
            </Link>
          )}
          {session?.role === "admin" && (
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
              {session?.name ?? "Alex Morgan"}
              <small>Local demo account</small>
            </span>
            <Tooltip label={t.logout}>
              <button
                className="icon-button"
                aria-label={t.logout}
                onClick={() => {
                  logout();
                  router.push("/login");
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
              <i />
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
        <div className="demo-banner" role="region" aria-label="Demo status">
          <span>
            <span className="live-dot" /> LOCAL DEMO
          </span>{" "}
          Your space to explore. Progress is saved in this browser.
          <Link href="/login">
            Switch role <ArrowUpRight size={12} />
          </Link>
        </div>
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
        description="Illustrative reminders for your demo workspace."
      >
        <div className="notification-item">
          <span className="skill-icon orange">
            <PenLine size={20} />
          </span>
          <div>
            <h4>Time for a little writing?</h4>
            <p>Your next Task 2 practice is ready whenever you are.</p>
            <Link className="text-link" href="/practice/writing">
              Open writing workspace →
            </Link>
          </div>
        </div>
        <div className="notice">
          Notifications are local examples. No email or push notifications are
          sent.
        </div>
      </Modal>
    </div>
  );
}
