"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Headphones,
  BookOpen,
  PenLine,
  Mic,
  Flame,
  Clock,
  ChevronRight,
  Check,
  Target,
  Play,
  Sparkles,
  CalendarDays,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
import { Card, Badge, Progress } from "@/components/ui/primitives";
import { SkillProgressChart } from "@/components/charts/skill-chart";
import { useAcademy } from "@/store/use-academy";
import { skills, translations } from "@/data/content";
const icons = {
  listening: Headphones,
  reading: BookOpen,
  writing: PenLine,
  speaking: Mic,
};
export function Dashboard() {
  const {
    session,
    lang,
    target,
    goals,
    toggleGoal,
    attempts,
    completed,
    drafts,
  } = useAcademy();
  const t = translations[lang];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-line" /> YOUR LEARNING JOURNEY
          </div>
          <h1>
            {t.greeting}, {session?.name.split(" ")[0] ?? "Alex"}{" "}
            <span className="wave">✺</span>
          </h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="date-chip">
          <CalendarDays size={16} />
          {new Intl.DateTimeFormat(
            lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-GB",
            {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "Asia/Tashkent",
            },
          ).format(new Date())}
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
            {t.practice}
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
      <section className="summary-grid">
        <Card className="overall-card">
          <div className="summary-label">
            Estimated overall band <Badge color="slate">SAMPLE</Badge>
          </div>
          <div className="overall-score">
            7.0 <span>/ 9</span>
            <span className="trend-chip">
              <TrendingUp size={13} /> +0.5
            </span>
          </div>
          <p>Illustrative score · not an official result</p>
        </Card>
        <Card>
          <div className="summary-label">
            <Target size={16} />
            {t.target}
          </div>
          <div className="summary-number">
            Band {target.toFixed(1)} <span className="summary-symbol">◎</span>
          </div>
          <Link className="subtle-link" href="/settings">
            Set a goal that moves you <ArrowUpRight size={13} />
          </Link>
        </Card>
        <Card>
          <div className="summary-label">
            <Clock size={16} />
            Practice completed
          </div>
          <div className="summary-number">
            {attempts.length.toString().padStart(2, "0")}{" "}
            <span className="unit">sessions</span>
          </div>
          <p>Your locally saved practice sessions</p>
        </Card>
        <Card>
          <div className="summary-label">
            <Flame size={16} className="text-orange" />
            Today’s intentions
          </div>
          <div className="summary-number">
            {goals.length}
            <span className="unit"> / 3 goals</span>
            <span className="little-flame">✧</span>
          </div>
          <p>Keep showing up for yourself</p>
        </Card>
      </section>
      <div className="section-heading">
        <div>
          <h2>{t.skills}</h2>
          <p>Four skills. One confident you.</p>
        </div>
        <Link className="subtle-link" href="/progress">
          View progress <ArrowUpRight size={15} />
        </Link>
      </div>
      <section className="skill-grid">
        {skills.map((s) => {
          const Icon = icons[s.id];
          return (
            <Link
              href={`/practice/${s.id}`}
              key={s.id}
              className={`card skill-card ${s.color}`}
            >
              <div className="skill-card-top">
                <span className={`skill-icon ${s.color}`}>
                  <Icon size={22} />
                </span>
                <ArrowUpRight size={17} className="muted" />
              </div>
              <h3>{t[s.id]}</h3>
              <p>{s.description}</p>
              <div className="skill-score">
                <strong>{s.band.toFixed(1)}</strong>
                <span>sample band</span>
              </div>
              <Progress
                value={s.progress}
                label={`${s.title} sample progress`}
              />
              <div className="skill-card-footer">
                <span>
                  {s.id === "writing" ? "Your next focus" : "Keep it going"}
                </span>
                <ArrowRight size={14} />
              </div>
            </Link>
          );
        })}
      </section>
      <div className="dashboard-columns">
        <div className="dashboard-main">
          <Card className="chart-card">
            <div className="section-heading">
              <div>
                <h3>A little progress adds up</h3>
                <p>Sample band scores over time</p>
              </div>
              <Badge color="slate">LAST 6 WEEKS</Badge>
            </div>
            <div className="chart-legend">
              {skills.map((s) => (
                <span key={s.id}>
                  <i className={s.color} />
                  {t[s.id]}
                </span>
              ))}
            </div>
            <SkillProgressChart />
          </Card>
          <Card className="continue-card">
            <div className="section-heading">
              <h3>{t.continue}</h3>
              <Link className="subtle-link" href="/courses">
                All courses <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="continue-content">
              <Link
                href="/courses?course=writing"
                className="lesson-art"
                aria-label="Open writing course"
              >
                <span aria-hidden="true">
                  Aa<span>↗</span>
                </span>
                <i aria-hidden="true">THE ART OF EXPRESSION</i>
              </Link>
              <div>
                <Badge color="orange">WRITING · TASK 2</Badge>
                <h3>The art of a Band 7 essay</h3>
                <p>Give your ideas the structure they deserve.</p>
                <div className="lesson-progress">
                  <Progress
                    value={Math.min(
                      100,
                      (completed.filter((c) => c.startsWith("writing-"))
                        .length /
                        8) *
                        100,
                    )}
                    label="Writing course completion"
                  />
                  <span>
                    {completed.filter((c) => c.startsWith("writing-")).length}/8
                    lessons
                  </span>
                </div>
                <Link className="text-link" href="/courses?course=writing">
                  Pick up where you left off <ArrowRight size={15} />
                </Link>
              </div>
              <Link
                href="/courses?course=writing"
                className="round-play"
                aria-label="Continue writing course"
              >
                <Play size={19} fill="currentColor" />
              </Link>
            </div>
          </Card>
          <Card>
            <div className="section-heading">
              <h3>Recent practice</h3>
              <Link href="/progress" className="subtle-link">
                View all <ArrowUpRight size={14} />
              </Link>
            </div>
            {attempts.length ? (
              attempts.slice(0, 3).map((a) => (
                <div className="recent-row" key={a.id}>
                  <span className="skill-icon blue">
                    <Check size={18} />
                  </span>
                  <div>
                    <h4>{a.title}</h4>
                    <p>
                      {new Date(a.date).toLocaleDateString()} ·{" "}
                      {a.status ?? "Completed"}
                    </p>
                  </div>
                  <Badge>
                    {a.band != null
                      ? `Est. ${a.band}`
                      : a.score != null
                        ? `${a.score}/${a.total}`
                        : "Saved"}
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
                <Link href="/practice/reading" className="button outline small">
                  Try a sample <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </Card>
          <Card className="recent-feedback">
            <div className="section-heading">
              <h3>Recent feedback</h3>
              <Badge color="slate">LOCAL DEMO</Badge>
            </div>
            <h4>
              {drafts["review-rv1"]
                ? "A note from your teacher"
                : "A little reflection goes a long way"}
            </h4>
            <p>
              {drafts["review-rv1"] ??
                "Feedback saved by the teacher demo for Alex’s sample essay will appear here. Your own Writing and Speaking submissions remain awaiting evaluation."}
            </p>
            <Link href="/practice/writing" className="text-link">
              Return to your writing <ArrowRight size={14} />
            </Link>
          </Card>
        </div>
        <div className="dashboard-aside">
          <Card className="daily-card">
            <div className="section-heading">
              <h3>A little every day</h3>
              <span className="goal-counter">{goals.length}/3</span>
            </div>
            <p>Make time for what matters to you.</p>
            <div className="goal-list">
              {[
                {
                  id: "read",
                  title: "Read something new",
                  sub: "One passage, a fresh perspective",
                },
                {
                  id: "listen",
                  title: "Tune your listening",
                  sub: "A short practice, a sharper ear",
                },
                {
                  id: "words",
                  title: "Put your thoughts into words",
                  sub: "Spend a little time writing",
                },
              ].map((g) => (
                <label
                  key={g.id}
                  className={`goal-item ${goals.includes(g.id) ? "checked" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={goals.includes(g.id)}
                    onChange={() => toggleGoal(g.id)}
                  />
                  <span>
                    <strong>{g.title}</strong>
                    <small>{g.sub}</small>
                  </span>
                </label>
              ))}
            </div>
            <Progress value={(goals.length / 3) * 100} label="Daily goals" />
            <p className="encouragement">
              {goals.length === 3
                ? "A lovely day of progress. Well done."
                : "Progress is a habit, not a finish line."}{" "}
              <span>↗</span>
            </p>
          </Card>
          <div className="focus-card">
            <div className="eyebrow">
              <Sparkles size={14} /> YOUR NEXT FOCUS
            </div>
            <h3>
              Great ideas.
              <br />
              Even better essays.
            </h3>
            <p>
              Practice turning your thoughts into a clear, compelling argument.
            </p>
            <Link href="/practice/writing">
              Open writing studio <ArrowUpRight size={17} />
            </Link>
            <div className="focus-decoration" aria-hidden="true">
              Aa<span>✎</span>
            </div>
          </div>
          <Card className="assignment-card">
            <div className="section-heading">
              <h3>On your horizon</h3>
              <CalendarDays size={17} />
            </div>
            <Badge color="purple">SAMPLE ASSIGNMENT</Badge>
            <h4>City life or country living?</h4>
            <p>Writing Task 2 · Opinion essay</p>
            <div className="assignment-bottom">
              <span>
                <Clock size={13} />
                40 min practice
              </span>
              <Link href="/practice/writing" aria-label="Open assignment">
                <ChevronRight size={18} />
              </Link>
            </div>
          </Card>
          <div className="quote-card">
            <span>“</span>
            <p>
              You don’t have to see the whole staircase. Just take the next
              step.
            </p>
            <small>A REMINDER FOR YOUR JOURNEY</small>
          </div>
        </div>
      </div>
    </>
  );
}
