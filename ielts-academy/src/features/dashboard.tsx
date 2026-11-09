"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Target,
  Clock,
  BookOpen,
  CalendarDays,
} from "lucide-react";
import { motion } from "motion/react";
import { Card, Badge, Progress } from "@/components/ui/primitives";
import { SkillProgressChart } from "@/components/charts/skill-chart";
import { useApp, useResource, ResourceState, Empty } from "./academy-context";
import { LearningProfile } from "./academy";
import { learningSkills, learningScores } from "./premium-ui";
import type { Row } from "@/lib/api";
export function Dashboard() {
  const { me, t } = useApp();
  const r = useResource<Record<string, Row[]>>("dashboard");
  const attempts = useResource<Row[]>("attempts");
  const submissions = useResource<{ writing: Row[]; speaking: Row[] }>(
    "submissions",
  );
  const mocks = useResource<Row[]>("mock-results");
  const scores = learningScores(
    attempts.data || [],
    submissions.data || { writing: [], speaking: [] },
  );
  const overall = mocks.data
    ?.map((x) => x.scorecard as { overall_band: number | null })
    .find((x) => x?.overall_band !== null)?.overall_band;
  const latest = (skill: string) =>
    scores.filter((x) => x.skill === skill).at(-1)?.band;
  const completed = (attempts.data || []).filter(
    (x) => x.status === "submitted",
  );
  const target = me?.onboarding?.target_band;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-line" /> YOUR LEARNING JOURNEY
          </div>
          <h1 aria-label={t("dashboard")}>
            Hello, {me?.profile.display_name.split(" ")[0]}{" "}
            <span className="wave">✺</span>
          </h1>
          <p>Your goals. Your pace. Your next chapter.</p>
        </div>
        <div className="date-chip">
          <CalendarDays size={16} />
          {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
            new Date(),
          )}
        </div>
      </div>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="welcome-card"
      >
        <div className="welcome-copy">
          <div className="hero-kicker">
            <span /> ONE STEP CLOSER
          </div>
          <h2>
            Your next chapter
            <br />
            starts with <em>you.</em>
          </h2>
          <p>
            Your goals are big. Your daily steps don’t have to be.
            <br className="desktop-only" /> Let’s make a little progress today.
          </p>
          <Link className="button white-button" href="/practice/reading">
            {t("start")}
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="floating-star">✦</div>
          <div className="art-book">
            <div className="book-spine" />
            <span>
              THE NEXT
              <br />
              <b>CHAPTER</b>
            </span>
            <div className="book-line" />
            <small>YOUR STORY STARTS HERE</small>
          </div>
          <div className="art-card">
            <span className="art-check">
              <Check size={17} />
            </span>
            <span>
              A little better.
              <br />
              <b>Every single day.</b>
            </span>
          </div>
          <div className="art-spark">✧</div>
          <div className="art-pencil" />
        </div>
        <div className="welcome-bottom">
          A space for your ambition. A plan for your progress.<span>✦</span>
        </div>
      </motion.section>

      <ResourceState
        loading={
          r.loading || attempts.loading || submissions.loading || mocks.loading
        }
        error={r.error || attempts.error || submissions.error || mocks.error}
      >
        <section className="summary-grid">
          <Card className="overall-card">
            <div className="summary-label">
              Latest mock band <Badge color="slate">ESTIMATE</Badge>
            </div>
            <div className="overall-score">
              {overall ?? "—"} <span>/ 9</span>
            </div>
            <p>
              {overall == null
                ? "Complete all four skills to see your result."
                : "From your completed, evaluated mock exam."}
            </p>
          </Card>
          <Card>
            <div className="summary-label">
              <Target size={16} />
              Your target
            </div>
            <div className="summary-number">
              {target ? `Band ${Number(target).toFixed(1)}` : "—"}{" "}
              <span className="summary-symbol">◎</span>
            </div>
            <Link href="/onboarding" className="subtle-link">
              Your learning profile <ArrowUpRight size={13} />
            </Link>
          </Card>
          <Card>
            <div className="summary-label">
              <Clock size={16} />
              Practice submitted
            </div>
            <div className="summary-number">
              {completed.length +
                (submissions.data?.writing.filter((x) => x.submitted_at)
                  .length || 0) +
                (submissions.data?.speaking.length || 0)}{" "}
              <span className="unit">sessions</span>
            </div>
            <p>Your saved learning history</p>
          </Card>
          <Card>
            <div className="summary-label">
              <BookOpen size={16} />
              Lessons completed
            </div>
            <div className="summary-number">
              {r.data?.lesson_progress.length || 0}{" "}
              <span className="unit">lessons</span>
            </div>
            <p>Small steps, lasting progress</p>
          </Card>
        </section>
        <div className="section-heading">
          <div>
            <h2>Make time for your skills</h2>
            <p>Four skills. One confident you.</p>
          </div>
          <Link className="subtle-link" href="/progress">
            View progress <ArrowUpRight size={15} />
          </Link>
        </div>
        <section className="skill-grid">
          {learningSkills.map((s) => (
            <Link
              href={"/practice/" + s.id}
              key={s.id}
              className={"card skill-card " + s.color}
            >
              <div className="skill-card-top">
                <span className={"skill-icon " + s.color}>
                  <s.icon size={22} />
                </span>
                <ArrowUpRight size={17} className="muted" />
              </div>
              <h3>{t(s.id)}</h3>
              <p>{s.description}</p>
              <div className="skill-score">
                <strong>{latest(s.id)?.toFixed(1) || "—"}</strong>
                <span>
                  {latest(s.id) == null
                    ? "No graded work yet"
                    : "latest estimated band"}
                </span>
              </div>
              <Progress
                value={((latest(s.id) || 0) / 9) * 100}
                label={s.title + " graded band"}
              />
              <div className="skill-card-footer">
                <span>Your next step</span>
                <ArrowRight size={14} />
              </div>
            </Link>
          ))}
        </section>
        <div className="dashboard-columns">
          <div className="dashboard-main">
            <Card className="chart-card">
              <div className="section-heading">
                <div>
                  <h3>A little progress adds up</h3>
                  <p>Your saved band scores over time</p>
                </div>
                <Badge color="slate">YOUR RESULTS</Badge>
              </div>
              <div className="chart-legend">
                {learningSkills.map((s) => (
                  <span key={s.id}>
                    <i className={s.color} />
                    {t(s.id)}
                  </span>
                ))}
              </div>
              <SkillProgressChart
                data={scores.map((s) => ({
                  week: new Date(s.date).toLocaleDateString(),
                  [s.skill[0].toUpperCase() + s.skill.slice(1)]: s.band,
                }))}
              />
            </Card>
            <Card className="continue-card">
              <div className="section-heading">
                <h3>Keep your next chapter moving</h3>
              </div>
              <div className="continue-content">
                <div className="lesson-art">
                  <span>Aa</span>
                </div>
                <div>
                  <h4>Your learning path</h4>
                  <p>
                    {r.data?.course_enrollments.length || 0} courses enrolled ·{" "}
                    {r.data?.lesson_progress.length || 0} lessons complete
                  </p>
                  <Link className="text-link" href="/courses">
                    Pick up where you left off <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            </Card>
            <Card>
              <div className="section-heading">
                <h3>Recent practice</h3>
                <Link href="/progress" className="subtle-link">
                  View all <ArrowUpRight size={14} />
                </Link>
              </div>
              {completed.length ? (
                completed.slice(0, 4).map((a) => (
                  <div className="recent-row" key={a.id}>
                    <span className="skill-icon blue">
                      <Check size={18} />
                    </span>
                    <div>
                      <h4>{String((a.tests as Row)?.title || "Practice")}</h4>
                      <p>
                        {new Date(String(a.submitted_at)).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge>
                      {a.band != null
                        ? `Est. ${a.band}`
                        : `${a.raw_score}/${a.total_points}`}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="recent-empty">
                  <span className="skill-icon blue">
                    <BookOpen size={20} />
                  </span>
                  <div>
                    <h4>A fresh start, full of possibility</h4>
                    <p>Your completed practice will appear here.</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
          <div className="dashboard-aside">
            <Card className="daily-card">
              <div className="section-heading">
                <h3>A little every day</h3>
                <span className="goal-counter">
                  {String(me?.onboarding?.daily_goal_minutes || "—")} min
                </span>
              </div>
              <p>Your daily practice goal</p>
              <LearningProfile />
            </Card>
            <Card>
              <div className="section-heading">
                <h3>{t("assignments")}</h3>
              </div>
              {r.data?.assignments.length ? (
                r.data.assignments.map((a) => (
                  <div className="recent-row" key={a.id}>
                    <div>
                      <h4>{a.title}</h4>
                      <p>{String(a.due_date || "")}</p>
                      <Link
                        className="text-link"
                        href={
                          a.test_id
                            ? "/practice/" +
                              String((a.tests as Row)?.skill || "reading")
                            : a.writing_task_id
                              ? "/practice/writing"
                              : a.speaking_task_id
                                ? "/practice/speaking"
                                : "/courses"
                        }
                      >
                        {t("start")} →
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <Empty />
              )}
            </Card>
          </div>
        </div>
      </ResourceState>
    </>
  );
}
