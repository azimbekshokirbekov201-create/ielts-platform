"use client";
import { useEffect } from "react";
import { useAcademy } from "@/store/use-academy";
import { useReady } from "@/hooks/use-ready";
import { Shell } from "@/components/layout/shell";
import { Marketing } from "@/features/marketing";
import { Dashboard } from "@/features/dashboard";
import { Auth } from "@/features/auth";
import { Practice } from "@/features/practice";
import { Writing } from "@/features/writing";
import { Speaking } from "@/features/speaking";
import { MockExam } from "@/features/mock-exam";
import { Courses } from "@/features/courses";
import { ProgressPage } from "@/features/progress";
import { Settings } from "@/features/settings";
import { RoleWorkspace } from "@/features/workspace";
export function Platform({ route }: { route: string }) {
  const theme = useAcademy((s) => s.theme);
  const lang = useAcademy((s) => s.lang);
  const ready = useReady();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
  }, [theme, lang]);
  if (route === "/") return <Marketing />;
  if (!ready)
    return (
      <div className="loading-screen">
        <span className="brand-icon">A</span>
        <p>Making room for your next chapter…</p>
      </div>
    );
  if (
    ["/login", "/register", "/forgot-password", "/reset-password"].includes(
      route,
    )
  )
    return <Auth route={route} />;
  return (
    <Shell route={route}>
      {route === "/dashboard" ? (
        <Dashboard />
      ) : route === "/practice/listening" ? (
        <Practice skill="listening" />
      ) : route === "/practice/reading" ? (
        <Practice skill="reading" />
      ) : route === "/practice/writing" ? (
        <Writing />
      ) : route === "/practice/speaking" ? (
        <Speaking />
      ) : route === "/mock-exams" ? (
        <MockExam />
      ) : route === "/courses" ? (
        <Courses />
      ) : route === "/progress" ? (
        <ProgressPage />
      ) : route === "/teacher" ? (
        <RoleWorkspace role="teacher" />
      ) : route === "/admin" ? (
        <RoleWorkspace role="admin" />
      ) : (
        <Settings />
      )}
    </Shell>
  );
}
