"use client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { trend } from "@/data/content";
export function SkillProgressChart({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Illustrative six-week band trends. Listening 5.5 to 7.5, Reading 5 to 7, Writing 5 to 6.5, Speaking 5.5 to 7."
    >
      <ResponsiveContainer
        width="100%"
        height={compact ? 180 : 250}
        minWidth={0}
      >
        <LineChart
          data={trend}
          margin={{ top: 15, right: 12, left: -25, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="4 5"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis
            dataKey="week"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            dy={10}
          />
          <YAxis
            domain={[4, 9]}
            ticks={[4, 5, 6, 7, 8, 9]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              fontSize: 12,
            }}
          />
          {["Listening", "Reading", "Writing", "Speaking"].map((key, i) => (
            <Line
              key={key}
              dataKey={key}
              type="monotone"
              stroke={["#2563eb", "#9374ed", "#eea05b", "#43a68e"][i]}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ActivityChart() {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Sample practice minutes: Monday 35, Tuesday 50, Wednesday 25, Thursday 65, Friday 42, Saturday 0, Sunday 0"
    >
      <ResponsiveContainer width="100%" height={180} minWidth={0}>
        <BarChart
          data={[
            { day: "M", minutes: 35 },
            { day: "T", minutes: 50 },
            { day: "W", minutes: 25 },
            { day: "T ", minutes: 65 },
            { day: "F", minutes: 42 },
            { day: "S", minutes: 0 },
            { day: "S ", minutes: 0 },
          ]}
        >
          <CartesianGrid
            vertical={false}
            strokeDasharray="4 4"
            stroke="var(--border)"
          />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}
          />
          <Bar
            dataKey="minutes"
            fill="#7298f3"
            radius={[5, 5, 0, 0]}
            maxBarSize={23}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
