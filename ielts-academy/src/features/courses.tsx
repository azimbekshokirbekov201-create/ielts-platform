"use client";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Clock,
  BookOpen,
  Check,
  Play,
  LockKeyhole,
} from "lucide-react";
import { useAcademy } from "@/store/use-academy";
import { courses } from "@/data/content";
import { Card, Badge, Tabs, Progress } from "@/components/ui/primitives";
const lessonTitles = [
  "Start with the big picture",
  "Read the question with purpose",
  "Build a simple plan",
  "Connect your ideas",
  "Choose precise language",
  "Practice with intention",
  "Reflect and refine",
  "Bring it all together",
];
export function Courses() {
  const [category, setCategory] = useState("All courses");
  const [selected, setSelected] = useState<string | null>(null);
  const [lesson, setLesson] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const store = useAcademy();
  useEffect(() => {
    const course = new URLSearchParams(window.location.search).get("course");
    if (courses.some((c) => c.id === course)) setSelected(course);
  }, []);
  const course = courses.find((c) => c.id === selected);
  if (course) {
    const done = store.completed.filter((c) =>
      c.startsWith(`${course.id}-`),
    ).length;
    const enrolled = store.enrolled.includes(course.id);
    return (
      <>
        <button
          className="button ghost back-button"
          onClick={() => {
            setSelected(null);
            setLesson(null);
          }}
        >
          <ArrowLeft size={15} />
          Back to courses
        </button>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              {course.category.toUpperCase()} · A LITTLE MORE CONFIDENCE
            </div>
            <h1>{course.title}</h1>
            <p>{course.description}</p>
          </div>
          <Badge color={course.color}>
            {enrolled ? "ENROLLED" : "DEMO COURSE"}
          </Badge>
        </div>
        <div className="course-workspace">
          <Card className="course-outline">
            <h3>Your learning path</h3>
            <Progress
              value={(done / course.lessons) * 100}
              label="Course progress"
            />
            <p>
              {done} of {course.lessons} lessons complete
            </p>
            {lessonTitles.slice(0, course.lessons).map((title, i) => (
              <button
                key={title}
                className={`lesson-link ${lesson === i ? "active" : ""}`}
                disabled={!enrolled}
                onClick={() => {
                  setLesson(i);
                  setAnswer("");
                  setChecked(false);
                }}
              >
                <span>
                  {store.completed.includes(`${course.id}-${i}`) ? (
                    <Check size={15} />
                  ) : (
                    i + 1
                  )}
                </span>
                {title}
                {!enrolled && <LockKeyhole size={13} />}
              </button>
            ))}
          </Card>
          <Card className="lesson-viewer">
            {lesson === null ? (
              <>
                <div className={`course-art ${course.color}`}>
                  <span>{course.icon}</span>
                  <small>MAKE ROOM FOR YOUR POTENTIAL</small>
                </div>
                <h2>Small lessons. Lasting habits.</h2>
                <p>
                  This original demo course introduces a reusable learning
                  routine: understand the task, plan an answer, practice, and
                  reflect. Each lesson applies the routine to a different focus.
                </p>
                <div className="metadata">
                  <span>
                    <BookOpen size={14} />
                    {course.lessons} lessons
                  </span>
                  <span>
                    <Clock size={14} />
                    {course.duration}
                  </span>
                  <span>Self-paced</span>
                </div>
                <button
                  className="button primary"
                  onClick={() => {
                    store.enroll(course.id);
                    setLesson(0);
                  }}
                >
                  {enrolled ? "Continue learning" : "Enroll in demo course"}
                  <ArrowRight size={16} />
                </button>
                <p className="caption">
                  Free local demo enrollment. No payment or account required.
                </p>
              </>
            ) : (
              <>
                <Badge color={course.color}>
                  LESSON {lesson + 1} / {course.lessons}
                </Badge>
                <h2>{lessonTitles[lesson]}</h2>
                <div className="video-placeholder">
                  <Play size={32} />
                  <h4>Video lesson · coming soon</h4>
                  <p>
                    No video is available in this frontend demo. The full text
                    lesson is below.
                  </p>
                </div>
                <h3>
                  {lesson === 0
                    ? "Understand before you begin"
                    : lesson === 1
                      ? "Notice what the task asks"
                      : lesson === 2
                        ? "Give your ideas a route"
                        : lesson === 3
                          ? "Make the connection"
                          : "Practice, then reflect"}
                </h3>
                <p>
                  {
                    [
                      "Before answering, identify the purpose of the task. Read the instructions twice and note any word limit. For Writing, underline the command words. For Reading and Listening, look at the question type before focusing on the source. For Speaking, identify the topic and the reason behind the question.",
                      "Read for intention, not just individual words. A task asking you to discuss both views needs two perspectives. A completion question may require only one word. Make a short mental checklist so your answer addresses the whole task.",
                      "A simple plan reduces hesitation. Group related ideas, put them in a logical order, and choose one useful example. For a passage, scan the headings first. For a spoken answer, decide on a beginning, a supporting detail, and a brief conclusion.",
                      "Connections help your listener or reader follow you. Use a linking phrase when it clarifies a relationship, such as cause, contrast, or example. Avoid adding linking words simply to sound formal. Meaning comes first.",
                      "Precision is more valuable than complexity. Choose words you understand and use them in a sentence. After practice, identify one phrase you used well and one you could improve. Keep this reflection short enough to repeat.",
                      "Practice one skill at a time. Set a manageable timer, attempt the task, and pause to review. Compare objective answers with the explanation. For subjective responses, note what you want a future teacher to review.",
                      "Read or listen to your response once more. Look for one idea that could be clearer and one detail that supports your main point. Rewrite or re-record that part. Improvement is often a small, deliberate revision.",
                      "Bring the routine together: understand, plan, practice, reflect. Choose a task from the practice workspace and follow the sequence independently. Return to this lesson whenever you need a simpler starting point.",
                    ][lesson]
                  }
                </p>
                <div className="lesson-exercise">
                  <h4>A moment to check your understanding</h4>
                  <p>
                    Which habit is most useful before beginning an IELTS task?
                  </p>
                  {[
                    "Start immediately without reading instructions",
                    "Identify the task, instructions, and word limit",
                    "Use the longest words you can remember",
                  ].map((a) => (
                    <label className="answer-option" key={a}>
                      <input
                        type="radio"
                        name="quiz"
                        value={a}
                        checked={answer === a}
                        onChange={() => {
                          setAnswer(a);
                          setChecked(false);
                        }}
                      />
                      {a}
                    </label>
                  ))}
                  <button
                    className="button outline small"
                    disabled={!answer}
                    onClick={() => setChecked(true)}
                  >
                    Check understanding
                  </button>
                  {checked && (
                    <p
                      role="status"
                      className={
                        answer.startsWith("Identify")
                          ? "text-green"
                          : "text-orange"
                      }
                    >
                      {answer.startsWith("Identify")
                        ? "Exactly. Understanding the task gives your practice direction."
                        : "Try again. Read the instructions and identify what you need to do first."}
                    </p>
                  )}
                </div>
                <button
                  className="button primary"
                  disabled={!checked || !answer.startsWith("Identify")}
                  onClick={() => {
                    store.complete(`${course.id}-${lesson}`);
                    if (lesson < course.lessons - 1) {
                      setLesson(lesson + 1);
                      setAnswer("");
                      setChecked(false);
                    } else setLesson(null);
                  }}
                >
                  <Check size={16} />
                  {lesson === course.lessons - 1
                    ? "Complete course"
                    : "Complete & continue"}
                </button>
              </>
            )}
          </Card>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LEARN WITH INTENTION</div>
          <h1>A little knowledge. A new possibility.</h1>
          <p>
            Thoughtful courses to meet you where you are, and take you a little
            further.
          </p>
        </div>
        <Badge color="purple">ORIGINAL DEMO LESSONS</Badge>
      </div>
      <Tabs
        items={[
          "All courses",
          "Writing",
          "Reading",
          "Listening",
          "Speaking",
          "Enrolled",
        ]}
        value={category}
        onChange={setCategory}
      />
      <div className="course-grid">
        {courses
          .filter(
            (c) =>
              category === "All courses" ||
              category === c.category ||
              (category === "Enrolled" && store.enrolled.includes(c.id)),
          )
          .map((c) => (
            <Card className="course-catalog-card" key={c.id}>
              <button
                className={`course-art ${c.color}`}
                aria-label={`View ${c.title}`}
                onClick={() => setSelected(c.id)}
              >
                <span aria-hidden="true">{c.icon}</span>
                <small aria-hidden="true">{c.tag}</small>
                <i aria-hidden="true">↗</i>
              </button>
              <div className="course-card-body">
                <Badge color={c.color}>{c.category.toUpperCase()}</Badge>
                <h2>{c.title}</h2>
                <p>{c.description}</p>
                <div className="metadata">
                  <span>
                    <BookOpen size={14} />
                    {c.lessons} lessons
                  </span>
                  <span>
                    <Clock size={14} />
                    {c.duration}
                  </span>
                </div>
                {store.enrolled.includes(c.id) && (
                  <Progress
                    value={
                      (store.completed.filter((s) => s.startsWith(c.id + "-"))
                        .length /
                        c.lessons) *
                      100
                    }
                    label={`${c.title} progress`}
                  />
                )}
                <button
                  className="button outline"
                  onClick={() => setSelected(c.id)}
                >
                  {store.enrolled.includes(c.id)
                    ? "Continue course"
                    : "Explore course"}
                  <ArrowRight size={16} />
                </button>
              </div>
            </Card>
          ))}
      </div>
      {category === "Enrolled" && !store.enrolled.length && (
        <Card>
          <h2>Your next chapter is waiting</h2>
          <p>Explore a course and enroll to start your learning path.</p>
          <button
            className="button primary"
            onClick={() => setCategory("All courses")}
          >
            Explore all courses
          </button>
        </Card>
      )}
    </>
  );
}
