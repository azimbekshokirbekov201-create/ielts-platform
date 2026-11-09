"use client";
import { AcademyProvider } from "./academy";
import { Shell } from "@/components/layout/shell";
import { Marketing } from "./marketing";
import { Auth } from "./auth";
import { Dashboard } from "./dashboard";
import { Courses } from "./courses";
import { Practice } from "./practice";
import { Writing } from "./writing";
import { Speaking } from "./speaking";
import { MockExam } from "./mock-exam";
import { ProgressPage } from "./progress";
import { Settings } from "./settings";
import { RoleWorkspace } from "./workspace";
import { Onboarding } from "./onboarding";
export function Platform({ route }: { route: string }) {
  const publicRoute = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ].includes(route);
  return (
    <AcademyProvider route={route}>
      {route === "/" ? (
        <Marketing />
      ) : publicRoute ? (
        <Auth route={route} />
      ) : (
        <Shell route={route}>
          {route === "/onboarding" ? (
            <Onboarding />
          ) : route === "/dashboard" ? (
            <Dashboard />
          ) : route === "/courses" ? (
            <Courses />
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
          ) : route === "/progress" ? (
            <ProgressPage />
          ) : route === "/admin" ? (
            <RoleWorkspace role="admin" />
          ) : route === "/teacher" ? (
            <RoleWorkspace role="teacher" />
          ) : (
            <Settings />
          )}
        </Shell>
      )}
    </AcademyProvider>
  );
}
