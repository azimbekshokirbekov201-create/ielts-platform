"use client";
import { BookOpen } from "lucide-react";
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

export function SkillProgressChart({
  compact = false,
  data = [],
}: {
  compact?: boolean;
  data?: Record<string, string | number>[];
}) {
  if (!data.length)
    return (
      <div className="chart-empty">
        <BookOpen size={28} />
        <p>Your graded practice will appear here.</p>
      </div>
    );
  return (
    <div
      className="chart"
      role="img"
      aria-label="Saved practice band scores over time"
    >
      <ResponsiveContainer
        width="100%"
        height={compact ? 180 : 250}
        minWidth={0}
      >
        <LineChart
          data={data}
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
            domain={[0, 9]}
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
              dot={{ r: 3 }}
              connectNulls
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ActivityChart({
  data = [],
}: {
  data?: { day: string; minutes: number }[];
}) {
  return (
    <div className="chart" role="img" aria-label="Recorded learning activity">
      <ResponsiveContainer width="100%" height={180} minWidth={0}>
        <BarChart data={data}>
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
