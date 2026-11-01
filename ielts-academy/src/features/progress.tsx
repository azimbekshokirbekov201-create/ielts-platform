"use client";
import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Target,
  BookOpen,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import {
  Card,
  Badge,
  Tabs,
  EmptyState,
  Progress,
  Pagination,
} from "@/components/ui/primitives";
import {
  SkillProgressChart,
  ActivityChart,
} from "@/components/charts/skill-chart";
import { skills, courses } from "@/data/content";
import { useAcademy } from "@/store/use-academy";
export function ProgressPage() {
  const store = useAcademy();
  const [filter, setFilter] = useState("All sessions");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<string | null>(null);
  const filtered = store.attempts.filter(
    (a) => filter === "All sessions" || a.skill === filter.toLowerCase(),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LOOK HOW FAR YOU CAN GO</div>
          <h1>Your progress has a story.</h1>
          <p>
            Celebrate the small steps. See where your next one could take you.
          </p>
        </div>
        <Link className="button outline" href="/settings">
          <Target size={16} />
          Target Band {store.target}
        </Link>
      </div>
      <div className="summary-grid">
        {[
          {
            label: "Completed sessions",
            value: store.attempts.length,
            icon: CheckCircle2,
          },
          {
            label: "Enrolled courses",
            value: store.enrolled.length,
            icon: BookOpen,
          },
          {
            label: "Completed lessons",
            value: store.completed.length,
            icon: CheckCircle2,
          },
          { label: "Daily goal", value: `${store.goal} min`, icon: Clock },
        ].map((s) => (
          <Card key={s.label}>
            <div className="summary-label">
              <s.icon size={17} />
              {s.label}
            </div>
            <div className="summary-number">{s.value}</div>
            <p>Your local progress</p>
          </Card>
        ))}
      </div>
      <div className="two-columns">
        <Card>
          <div className="section-heading">
            <h3>Your possible trajectory</h3>
            <Badge color="slate">SAMPLE DATA</Badge>
          </div>
          <div className="chart-legend">
            {skills.map((s) => (
              <span key={s.id}>
                <i className={s.color} />
                {s.title}
              </span>
            ))}
          </div>
          <SkillProgressChart />
          <p className="caption">
            Illustrative trends. Not calculated from your practice.
          </p>
        </Card>
        <Card>
          <div className="section-heading">
            <h3>A week of small steps</h3>
            <Badge color="slate">SAMPLE DATA</Badge>
          </div>
          <ActivityChart />
          <p className="notice">
            Your actual completed sessions are listed below. This chart
            demonstrates a possible weekly activity view.
          </p>
        </Card>
      </div>
      <div className="two-columns">
        <Card>
          <h3>Make your next step count</h3>
          <p>Illustrative strengths & opportunities</p>
          {skills.map((s) => (
            <div className="criterion" key={s.id}>
              <div>
                <span>{s.title}</span>
                <span>
                  {s.id === "writing" ? "Focus area" : "Sample strength"}
                </span>
              </div>
              <Progress
                value={s.progress}
                label={`${s.title} illustrative performance`}
              />
            </div>
          ))}
        </Card>
        <Card>
          <h3>Your courses, in motion</h3>
          {store.enrolled.length ? (
            courses
              .filter((c) => store.enrolled.includes(c.id))
              .map((c) => (
                <div className="criterion" key={c.id}>
                  <div>
                    <span>{c.title}</span>
                    <span>
                      {
                        store.completed.filter((s) => s.startsWith(c.id + "-"))
                          .length
                      }
                      /{c.lessons}
                    </span>
                  </div>
                  <Progress
                    value={
                      (store.completed.filter((s) => s.startsWith(c.id + "-"))
                        .length /
                        c.lessons) *
                      100
                    }
                    label={c.title}
                  />
                </div>
              ))
          ) : (
            <EmptyState
              title="Room to grow"
              description="Enroll in a course to start tracking your lessons."
            />
          )}
          <Link href="/courses" className="text-link">
            Explore courses <ArrowUpRight size={15} />
          </Link>
        </Card>
      </div>
      <Card>
        <div className="section-heading">
          <h2>Your actual practice history</h2>
          <Badge color="green">LOCAL DATA</Badge>
        </div>
        <Tabs
          items={[
            "All sessions",
            "Listening",
            "Reading",
            "Writing",
            "Speaking",
            "Mock",
          ]}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
        />
        {filtered.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Practice</th>
                    <th>Completed</th>
                    <th>Result</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice((page - 1) * 6, page * 6).map((a) => (
                    <tr key={a.id}>
                      <td>{a.title}</td>
                      <td>{new Date(a.date).toLocaleDateString()}</td>
                      <td>
                        <Badge color="slate">
                          {a.score != null
                            ? `${a.score}/${a.total} correct`
                            : a.status}
                        </Badge>
                      </td>
                      <td>
                        <button
                          className="button ghost small"
                          onClick={() =>
                            setDetail(detail === a.id ? null : a.id)
                          }
                        >
                          {detail === a.id ? "Hide" : "Details"}
                        </button>
                        {detail === a.id && (
                          <div className="history-detail">
                            <p>
                              {a.band != null
                                ? `Illustrative sample band: ${a.band}. Not an official IELTS result.`
                                : a.status}
                            </p>
                            {a.answers &&
                              Object.entries(a.answers).map(([id, v]) => (
                                <p key={id}>
                                  {id.toUpperCase()}: {v || "Unanswered"}
                                </p>
                              ))}
                            {a.text && <p>{a.text.replace(/<[^>]*>/g, " ")}</p>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              total={Math.ceil(filtered.length / 6)}
              onChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            title="Your story starts with a first session"
            description="Completed practice will appear here, saved in this browser."
          />
        )}
      </Card>
    </>
  );
}
