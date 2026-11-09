"use client";
import { ContentStudio, TeacherWorkspace } from "./content-studio";
import { useApp } from "./academy-context";
export function RoleWorkspace({ role }: { role: "admin" | "teacher" }) {
  const { me } = useApp();
  if (
    (role === "admin" && !me?.roles.includes("ADMIN")) ||
    (role === "teacher" &&
      !me?.roles.some((x) => ["TEACHER", "ADMIN"].includes(x)))
  )
    return null;
  return (
    <div className="premium-learning premium-workspace">
      <div className="eyebrow">
        <span className="tiny-line" />{" "}
        {role === "admin"
          ? "YOUR ACADEMY, THOUGHTFULLY MANAGED"
          : "A LITTLE GUIDANCE. A LASTING DIFFERENCE."}
      </div>
      {role === "admin" ? <ContentStudio /> : <TeacherWorkspace />}
    </div>
  );
}
