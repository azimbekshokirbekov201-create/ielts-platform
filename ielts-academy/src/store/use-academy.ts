"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Attempt, Role, Row } from "@/types";
import { initialRows } from "@/data/content";
type State = {
  session: { name: string; email: string; role: Role } | null;
  lang: "en" | "uz" | "ru";
  theme: "light" | "dark";
  target: number;
  goal: number;
  drafts: Record<string, string>;
  answers: Record<string, Record<string, string>>;
  attempts: Attempt[];
  enrolled: string[];
  completed: string[];
  rows: Record<string, Row[]>;
  goals: string[];
  login: (name: string, email: string, role: Role) => void;
  logout: () => void;
  preferences: (
    values: Partial<Pick<State, "lang" | "theme" | "target" | "goal">>,
  ) => void;
  draft: (key: string, value: string) => void;
  answer: (key: string, id: string, value: string) => void;
  addAttempt: (a: Attempt) => void;
  enroll: (id: string) => void;
  complete: (id: string) => void;
  toggleGoal: (id: string) => void;
  saveRow: (group: string, row: Row) => void;
  deleteRow: (group: string, id: string) => void;
};
export const useAcademy = create<State>()(
  persist(
    (set) => ({
      session: null,
      lang: "en",
      theme: "light",
      target: 7.5,
      goal: 30,
      drafts: {},
      answers: {},
      attempts: [],
      enrolled: [],
      completed: [],
      rows: initialRows,
      goals: [],
      login: (name, email, role) => set({ session: { name, email, role } }),
      logout: () => set({ session: null }),
      preferences: (values) => set(values),
      draft: (key, value) =>
        set((s) => ({ drafts: { ...s.drafts, [key]: value } })),
      answer: (key, id, value) =>
        set((s) => ({
          answers: { ...s.answers, [key]: { ...s.answers[key], [id]: value } },
        })),
      addAttempt: (a) => set((s) => ({ attempts: [a, ...s.attempts] })),
      enroll: (id) =>
        set((s) => ({ enrolled: [...new Set([...s.enrolled, id])] })),
      complete: (id) =>
        set((s) => ({ completed: [...new Set([...s.completed, id])] })),
      toggleGoal: (id) =>
        set((s) => ({
          goals: s.goals.includes(id)
            ? s.goals.filter((g) => g !== id)
            : [...s.goals, id],
        })),
      saveRow: (group, row) =>
        set((s) => ({
          rows: {
            ...s.rows,
            [group]: s.rows[group]?.some((r) => r.id === row.id)
              ? s.rows[group].map((r) => (r.id === row.id ? row : r))
              : [...(s.rows[group] ?? []), row],
          },
        })),
      deleteRow: (group, id) =>
        set((s) => ({
          rows: {
            ...s.rows,
            [group]: s.rows[group].filter((r) => r.id !== id),
          },
        })),
    }),
    { name: "ielts-academy-v1", version: 1 },
  ),
);
