"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Headphones,
  BookOpen,
  PenLine,
  Mic,
  Sparkles,
  Play,
  ChevronDown,
  Menu,
  X,
  Target,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { motion } from "motion/react";
import { Brand } from "@/components/layout/shell";
import { Card, Badge, Modal } from "@/components/ui/primitives";
import { SkillProgressChart } from "@/components/charts/skill-chart";
import { learningSkills as skills, LanguageControl } from "./premium-ui";
import { useApp } from "./academy-context";
export function Marketing() {
  const { t, me } = useApp();
  const [mobile, setMobile] = useState(false);
  const [plan, setPlan] = useState("");
  return (
    <div className="marketing">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="marketing-nav">
        <Brand />
        <nav className={mobile ? "open" : ""}>
          <a href="#experience" onClick={() => setMobile(false)}>
            The experience
          </a>
          <a href="#skills" onClick={() => setMobile(false)}>
            Practice
          </a>
          <Link href="/courses">Courses</Link>
          <a href="#pricing" onClick={() => setMobile(false)}>
            Plans
          </a>
        </nav>
        <div>
          <LanguageControl />
          <Link className="button ghost" href={me ? me.destination : "/login"}>
            {t(me ? "dashboard" : "login")}
          </Link>
          <Link className="button primary" href="/register">
            Get started <ArrowUpRight size={15} />
          </Link>
          <button
            className="icon-button mobile-only"
            aria-label="Toggle navigation"
            onClick={() => setMobile((v) => !v)}
          >
            {mobile ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="eyebrow">
                <span className="tiny-line" /> A LITTLE PRACTICE. A BIG
                POSSIBILITY.
              </div>
              <h1>
                {t("premium_ambition")}
                <br />
                {t("premium_little")} <em>{t("premium_direction")}</em>
                <span className="hero-asterisk">✳</span>
              </h1>
              <p>
                Make room for your next chapter. A thoughtful space to build
                your IELTS skills, find your confidence, and move forward — one
                day at a time.
              </p>
              <div className="hero-buttons">
                <Link className="button primary" href="/register">
                  Start your next chapter <ArrowUpRight size={17} />
                </Link>
                <Link className="button outline" href="/dashboard">
                  <Play size={15} />
                  Explore your workspace
                </Link>
              </div>
              <div className="hero-fineprint">
                <span>
                  <Check size={14} />
                  All four IELTS skills
                </span>
                <span>
                  <Check size={14} />
                  Your own pace
                </span>
                <span>
                  <Check size={14} />
                  No payment needed
                </span>
              </div>
            </motion.div>
            <div className="landing-note">
              <span>01 — YOUR POTENTIAL, MEET YOUR PLAN</span>
              <ArrowRight size={17} />
            </div>
          </div>
          <div className="landing-visual">
            <div className="landing-orbit" />
            <div className="landing-poster">
              <div className="poster-heading">
                A LITTLE
                <br />
                BETTER.
                <br />
                <em>EVERY DAY.</em>
              </div>
              <div className="poster-book">
                <BookOpen size={80} strokeWidth={1} />
                <span>THE NEXT CHAPTER</span>
              </div>
              <div className="poster-bottom">
                BIG DREAMS. SMALL STEPS.<span>↗</span>
              </div>
            </div>
            <div className="landing-float-score">
              <span className="float-target">
                <Target size={22} />
              </span>
              <div>
                <small>YOUR NEXT MILESTONE</small>
                <strong>
                  Your goal <span>↗</span>
                </strong>
              </div>
            </div>
            <div className="landing-float-note">
              <span>✦</span>A little progress
              <br />
              <b>is still progress.</b>
            </div>
            <span className="visual-star">✧</span>
            <div className="visual-label">AN INTENTIONAL SPACE TO GROW</div>
          </div>
        </section>
        <section className="value-strip">
          <span>
            FOUR SKILLS.
            <br />
            <strong>ONE CONFIDENT YOU.</strong>
          </span>
          {[
            { icon: Headphones, title: "Listen with intention" },
            { icon: BookOpen, title: "Read with perspective" },
            { icon: PenLine, title: "Write with clarity" },
            { icon: Mic, title: "Speak with confidence" },
          ].map((v) => (
            <div key={v.title}>
              <v.icon size={22} />
              <span>{v.title}</span>
            </div>
          ))}
        </section>
        <section id="experience" className="landing-section experience-section">
          <div className="landing-section-heading">
            <div>
              <div className="eyebrow">A PLACE FOR YOUR PROGRESS</div>
              <h2>
                Less overwhelm.
                <br />
                <em>More possibility.</em>
              </h2>
            </div>
            <div>
              <p>
                Your goals deserve more than a pile of practice tests. Find your
                next step, see your progress, and build a routine that feels
                like yours.
              </p>
              <Link href="/dashboard" className="text-link">
                Step inside your workspace <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
          <Link href="/dashboard" className="dashboard-preview">
            <div className="preview-top">
              <div className="window-dots">
                <i />
                <i />
                <i />
              </div>
              <span>YOUR PERSONAL LEARNING SPACE</span>
              <ArrowUpRight size={16} />
            </div>
            <div className="preview-body">
              <aside>
                <span className="brand-icon">
                  <BookOpen size={20} />
                </span>
                <div className="preview-active">Overview</div>
                <div>Listening</div>
                <div>Reading</div>
                <div>Writing</div>
                <div>Speaking</div>
                <hr />
                <div>My progress</div>
              </aside>
              <div className="preview-main">
                <div className="preview-greeting">
                  <h3>
                    Make progress, every day. <span>✺</span>
                  </h3>
                  <Badge color="slate">WORKSPACE PREVIEW</Badge>
                </div>
                <div className="preview-welcome">
                  <div>
                    <small>ONE STEP CLOSER</small>
                    <h3>
                      Your next chapter
                      <br />
                      starts with you.
                    </h3>
                    <span>Start practicing →</span>
                  </div>
                  <span aria-hidden="true">
                    Aa<span>✦</span>
                  </span>
                </div>
                <div className="preview-scores">
                  {skills.map((s) => (
                    <div key={s.id}>
                      <small>{s.title}</small>
                      <strong>
                        —<span>/9</span>
                      </strong>
                      <div className={`preview-progress ${s.color}`} />
                    </div>
                  ))}
                </div>
                <div className="preview-chart">
                  <div>
                    <h4>A little progress adds up</h4>
                    <p>Your results appear after graded practice</p>
                  </div>
                  <SkillProgressChart compact />
                </div>
              </div>
            </div>
          </Link>
          <div className="preview-caption">
            <span>
              <ShieldCheck size={14} />
              Private accounts · progress saved to your academy
            </span>
            <Link href="/dashboard">
              Take a closer look <ArrowRight size={14} />
            </Link>
          </div>
        </section>
        <section className="landing-section skills-section" id="skills">
          <div className="landing-section-heading">
            <div>
              <div className="eyebrow">PRACTICE WITH PURPOSE</div>
              <h2>
                Four ways to find
                <br />
                <em>your confidence.</em>
              </h2>
            </div>
            <p>
              Focused practice, considered workspaces, and useful reflections.
              Every skill gets the space it deserves.
            </p>
          </div>
          <div className="landing-skills">
            {skills.map((s, i) => {
              const Icon = [Headphones, BookOpen, PenLine, Mic][i];
              return (
                <Link
                  href={`/practice/${s.id}`}
                  className={`landing-skill ${s.color}`}
                  key={s.id}
                >
                  <div>
                    <span className="skill-index">0{i + 1}</span>
                    <ArrowUpRight size={21} />
                  </div>
                  <Icon
                    className="landing-skill-icon"
                    size={38}
                    strokeWidth={1.5}
                  />
                  <h3>{s.title}</h3>
                  <p>{s.description}</p>
                  <span className="text-link">
                    Make a start <ArrowRight size={15} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
        <section className="landing-section learning-section">
          <div className="learning-note">
            <div className="eyebrow">BEYOND AN ANSWER KEY</div>
            <h2>
              Practice.
              <br />
              Reflect.
              <br />
              <em>Grow.</em>
            </h2>
            <p>
              Understand a little more with every attempt. Save your drafts,
              review your answers, and make your next session count.
            </p>
            <Link href="/progress" className="button outline">
              See the bigger picture <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="learning-feature-grid">
            <Card>
              <span className="skill-icon purple">
                <Sparkles />
              </span>
              <h3>A thoughtful AI examiner</h3>
              <p>
                Explore a clearly labeled feedback preview. Live AI evaluation
                is planned for a future release.
              </p>
              <Badge color="purple">UPCOMING · WORKSPACE PREVIEW</Badge>
              <Link href="/practice/writing" className="text-link">
                Explore the writing studio <ArrowRight size={14} />
              </Link>
            </Card>
            <Card>
              <span className="skill-icon blue">
                <Clock />
              </span>
              <h3>See the whole journey</h3>
              <p>
                Move through all four skills in a guided mock exam, with timers
                and saved answers.
              </p>
              <Badge color="blue">SHORT SAMPLE EXAM</Badge>
              <Link href="/mock-exams" className="text-link">
                Explore mock exams <ArrowRight size={14} />
              </Link>
            </Card>
            <Card className="learning-progress-card">
              <div>
                <span className="skill-icon green">
                  <Target />
                </span>
                <h3>Small steps, made visible.</h3>
                <p>
                  Track your practice history and graded results in one calm
                  space.
                </p>
                <Link href="/progress" className="text-link">
                  Explore your progress <ArrowRight size={14} />
                </Link>
              </div>
              <div className="progress-art" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <span>↗</span>
              </div>
            </Card>
          </div>
        </section>
        <section className="landing-section">
          <div className="landing-section-heading">
            <div>
              <div className="eyebrow">KNOWLEDGE THAT MOVES YOU</div>
              <h2>
                A little learning.
                <br />
                <em>A lasting difference.</em>
              </h2>
            </div>
            <Link href="/courses" className="button outline">
              Explore all courses <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="marketing-course-grid">
            {skills.slice(0, 3).map((c) => (
              <Link
                key={c.id}
                href="/courses"
                className="card marketing-course"
              >
                <div className={"course-art " + c.color}>
                  <span>
                    <c.icon size={44} />
                  </span>
                  <small>MAKE ROOM FOR YOUR POTENTIAL</small>
                </div>
                <div>
                  <Badge color={c.color}>{c.title.toUpperCase()}</Badge>
                  <h3>Make space for {c.id}</h3>
                  <p>{c.description}</p>
                  <span className="text-link">
                    Explore the learning library <ArrowRight size={15} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
        <section className="landing-section pricing-section" id="pricing">
          <div className="landing-section-heading">
            <div>
              <div className="eyebrow">ROOM FOR EVERY AMBITION</div>
              <h2>
                Start where you are.
                <br />
                <em>Grow from here.</em>
              </h2>
            </div>
            <p>
              Start with practice, courses and saved progress. Paid plans are a
              product preview, with no checkout connected.
            </p>
          </div>
          <div className="pricing-grid">
            {[
              {
                name: "Explore",
                price: "Free",
                sub: "A little space to begin.",
                items: [
                  "Four skill practice",
                  "Published learning courses",
                  "Saved progress & drafts",
                  "Student learning workspace",
                ],
                cta: "Explore your workspace",
              },
              {
                name: "Grow",
                price: "Coming soon",
                sub: "A little more direction.",
                items: [
                  "Planned: expanded test library",
                  "Planned: AI-assisted feedback",
                  "Planned: personal study plans",
                  "Planned: cross-device progress",
                ],
                cta: "View plan preview",
              },
              {
                name: "Together",
                price: "Coming soon",
                sub: "For learning that brings us together.",
                items: [
                  "Planned: language center tools",
                  "Planned: live class management",
                  "Planned: teacher review workflows",
                  "Planned: organization reporting",
                ],
                cta: "View center preview",
              },
            ].map((p, i) => (
              <Card key={p.name} className={i === 1 ? "featured-plan" : ""}>
                {i === 1 && <Badge color="blue">THE NEXT CHAPTER</Badge>}
                <h3>{p.name}</h3>
                <p>{p.sub}</p>
                <div className="plan-price">{p.price}</div>
                <ul className="check-list">
                  {p.items.map((item) => (
                    <li key={item}>
                      <Check size={15} />
                      {item}
                    </li>
                  ))}
                </ul>
                {i === 0 ? (
                  <Link href="/dashboard" className="button outline">
                    {p.cta}
                    <ArrowUpRight size={15} />
                  </Link>
                ) : (
                  <button
                    className={`button ${i === 1 ? "primary" : "outline"}`}
                    onClick={() => setPlan(p.name)}
                  >
                    {p.cta}
                    <ArrowUpRight size={15} />
                  </button>
                )}
              </Card>
            ))}
          </div>
        </section>
        <section className="landing-section faq-section">
          <div>
            <div className="eyebrow">A LITTLE CLARITY</div>
            <h2>
              Good questions.
              <br />
              <em>Honest answers.</em>
            </h2>
          </div>
          <div className="faq-list">
            {[
              {
                q: "Is this an official IELTS platform?",
                a: "No. IELTS Academy is an independent learning platform. It is not affiliated with or endorsed by IELTS, the British Council, IDP, or Cambridge. Learning content is published by your academy administrators.",
              },
              {
                q: "Can I use the practice tools for free?",
                a: "There is no payment gateway or checkout. Paid plans are previews only; register to access the published learning library.",
              },
              {
                q: "Are the AI scores real evaluations?",
                a: "Reading and Listening answers are graded by the server. Writing and Speaking can receive teacher reviews. Optional AI feedback requires academy configuration and your consent, and is clearly identified as an estimate.",
              },
              {
                q: "Where is my progress saved?",
                a: "Your work is saved to your academy account. Sign in to resume your courses, drafts and results. Recordings are private and accessible only to you and authorized reviewers.",
              },
              {
                q: "Does the platform support Uzbek and Russian?",
                a: "Navigation, dashboard headings, and core preferences can be switched to English, Uzbek, or Russian. IELTS practice material and detailed educational copy are in English.",
              },
              {
                q: "Can teachers and language centers try it?",
                a: "Yes. Administrators assign Teacher roles and student relationships. Teachers can review assigned students; administrators manage content and permissions. Roles are verified by the server.",
              },
            ].map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <ChevronDown size={18} />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="landing-cta">
          <span>✳</span>
          <div className="eyebrow">YOUR NEXT CHAPTER IS WAITING</div>
          <h2>
            Big dreams.
            <br />
            <em>Small steps.</em>
          </h2>
          <p>Make a little progress today.</p>
          <Link href="/register" className="button white-button">
            Let’s get started <ArrowUpRight size={17} />
          </Link>
        </section>
      </main>
      <footer className="marketing-footer">
        <div>
          <Brand />
          <p>An intentional space for your ambition.</p>
        </div>
        <div>
          <Link href="/dashboard">Demo workspace</Link>
          <Link href="/courses">Courses</Link>
          <Link href="/login">Teacher & admin access</Link>
          <Link href="/settings">Privacy & preferences</Link>
        </div>
        <div className="footer-legal">
          <span>© 2026 IELTS Academy. An independent learning platform.</span>
          <span>Built for your next chapter.</span>
        </div>
      </footer>
      <Modal
        open={!!plan}
        onOpenChange={(open) => {
          if (!open) setPlan("");
        }}
        title={`${plan} · a preview of what’s next`}
        description="This is a product concept, not an available paid subscription."
      >
        <p>
          There is no checkout, billing, or payment collection. Explore the free
          academy today to start your learning journey.
        </p>
        <Link href="/dashboard" className="button primary">
          Create your account <ArrowRight size={16} />
        </Link>
      </Modal>
    </div>
  );
}
