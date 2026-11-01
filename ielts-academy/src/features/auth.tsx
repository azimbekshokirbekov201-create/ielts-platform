"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { Brand } from "@/components/layout/shell";
import { useAcademy } from "@/store/use-academy";
import { Input, Badge } from "@/components/ui/primitives";
import type { Role } from "@/types";
export function Auth({ route }: { route: string }) {
  const registerMode = route === "/register";
  const forgot = route === "/forgot-password";
  const reset = route === "/reset-password";
  const [role, setRole] = useState<Role>("student");
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const store = useAcademy();
  const router = useRouter();
  const schema = z.object({
    name: registerMode
      ? z.string().min(2, "Please enter at least 2 characters.")
      : z.string(),
    email: reset ? z.string() : z.email("Enter a valid email address."),
    password: forgot
      ? z.string()
      : z.string().min(8, "Use at least 8 characters."),
  });
  type Values = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "" },
  });
  function enterDemo(selected: Role) {
    store.login(
      selected === "student"
        ? "Alex Morgan"
        : selected === "teacher"
          ? "Jamie Taylor"
          : "Jordan Lee",
      `${selected}@example.com`,
      selected,
    );
    router.push(selected === "student" ? "/dashboard" : `/${selected}`);
  }
  return (
    <div className="auth-layout">
      <div className="auth-brand-panel">
        <Brand />
        <div>
          <div className="hero-kicker">
            A LITTLE PRACTICE. A BIG POSSIBILITY.
          </div>
          <h1>
            Your ambition.
            <br />
            Your pace.
            <br />
            <em>Your next chapter.</em>
          </h1>
          <p>
            An intentional space to learn, practice, and grow into the
            confidence you’re looking for.
          </p>
          <div className="auth-art" aria-hidden="true">
            <span>Aa</span>
            <i>✦</i>
            <small>MAKE ROOM FOR YOUR POTENTIAL</small>
          </div>
        </div>
        <span className="caption">
          © 2026 IELTS Academy · Frontend demonstration
        </span>
      </div>
      <main className="auth-form-panel">
        <Link href="/" className="subtle-link auth-back">
          ← Back to home
        </Link>
        <div className="auth-form-wrap">
          <Badge color="blue">LOCAL DEMO · NO BACKEND</Badge>
          <h1>
            {forgot
              ? "A fresh start."
              : reset
                ? "Choose a new beginning."
                : registerMode
                  ? "Your next chapter begins here."
                  : "Welcome back."}
          </h1>
          <p>
            {forgot
              ? "Explore the password recovery experience."
              : reset
                ? "This is a reset password UI demonstration."
                : registerMode
                  ? "Make a little space for your ambition."
                  : "A little practice today. A little closer to your goal."}
          </p>
          {done ? (
            <div className="auth-success" role="status">
              <CheckCircle2 size={36} />
              <h2>
                {forgot
                  ? "Recovery preview complete"
                  : "Reset preview complete"}
              </h2>
              <p>
                {forgot
                  ? "No recovery email was sent. There is no authentication server connected."
                  : "No password was changed. Demo sessions do not use passwords."}
              </p>
              <Link
                href={forgot ? "/reset-password" : "/login"}
                className="button primary"
              >
                {forgot ? "Preview reset screen" : "Back to login"}
                <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit((values) => {
                if (forgot || reset) {
                  setDone(true);
                  return;
                }
                store.login(
                  values.name || values.email.split("@")[0],
                  values.email,
                  role,
                );
                router.push(role === "student" ? "/dashboard" : `/${role}`);
              })}
              className="form-stack"
              noValidate
            >
              {registerMode && (
                <label className="field">
                  Full name
                  <Input
                    autoComplete="name"
                    {...register("name")}
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && (
                    <span role="alert" className="field-error">
                      {errors.name.message}
                    </span>
                  )}
                </label>
              )}
              {!reset && (
                <label className="field">
                  Email address
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...register("email")}
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && (
                    <span role="alert" className="field-error">
                      {errors.email.message}
                    </span>
                  )}
                </label>
              )}
              {!forgot && (
                <div className="field">
                  <label htmlFor="auth-password">
                    {reset ? "New password" : "Password (UI only — not stored)"}
                  </label>
                  <div className="password-field">
                    <Input
                      id="auth-password"
                      type={show ? "text" : "password"}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      {...register("password")}
                      aria-invalid={!!errors.password}
                      aria-describedby={
                        errors.password ? "password-error" : undefined
                      }
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={show ? "Hide password" : "Show password"}
                      onClick={() => setShow((s) => !s)}
                    >
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <span
                      id="password-error"
                      role="alert"
                      className="field-error"
                    >
                      {errors.password.message}
                    </span>
                  )}
                </div>
              )}
              {!forgot && !reset && (
                <>
                  <label className="field">
                    Demo role
                    <select
                      className="input"
                      value={role}
                      onChange={(e) => setRole(e.target.value as Role)}
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  {!registerMode && (
                    <Link
                      className="text-link forgot-link"
                      href="/forgot-password"
                    >
                      Forgot password?
                    </Link>
                  )}
                </>
              )}
              <button className="button primary" type="submit">
                {forgot
                  ? "Preview recovery"
                  : reset
                    ? "Preview password reset"
                    : registerMode
                      ? "Create local demo session"
                      : "Enter demo workspace"}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
          {!forgot && !reset && (
            <>
              <div className="auth-divider">
                <span>or explore a ready-made demo</span>
              </div>
              <div className="demo-role-buttons">
                {[
                  { role: "student" as const, icon: BookOpen },
                  { role: "teacher" as const, icon: GraduationCap },
                  { role: "admin" as const, icon: ShieldCheck },
                ].map((r) => (
                  <button
                    key={r.role}
                    className="button outline"
                    onClick={() => enterDemo(r.role)}
                  >
                    <r.icon size={18} />
                    {r.role}
                  </button>
                ))}
              </div>
              <p className="auth-switch">
                {registerMode ? "Already exploring?" : "New around here?"}{" "}
                <Link
                  className="text-link"
                  href={registerMode ? "/login" : "/register"}
                >
                  {registerMode ? "Sign in" : "Get started"}
                </Link>
              </p>
            </>
          )}
          <div className="notice">
            <ShieldCheck size={16} />
            <span>
              Demo authentication is not secure production authentication.
              Passwords are validated for the UI only and are never stored or
              sent. Use example details.
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
