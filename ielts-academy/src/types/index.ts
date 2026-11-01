export type Role = "student" | "teacher" | "admin";
export type Skill = "listening" | "reading" | "writing" | "speaking";
export type Question = {
  id: string;
  section: number;
  type: string;
  text: string;
  answer: string;
  options?: string[];
  explanation: string;
};
export type Attempt = {
  id: string;
  skill: Skill | "mock";
  title: string;
  date: string;
  score?: number;
  total?: number;
  band?: number;
  answers?: Record<string, string>;
  feedback?: boolean;
  text?: string;
  status?: string;
};
export type Row = { id: string; name: string; detail: string; status: string };
