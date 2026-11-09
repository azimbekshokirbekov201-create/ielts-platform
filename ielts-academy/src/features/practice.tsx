"use client";
import { PracticeRoom } from "./learning-rooms";
export function Practice({ skill }: { skill: "listening" | "reading" }) {
  return (
    <div className="premium-learning">
      <PracticeRoom skill={skill} />
    </div>
  );
}
