import { youtubeId, isYouTube } from "@/lib/youtube";
import { z } from "zod";
export const uuid = z.uuid();
const title = z.string().trim().min(1).max(200);
const text = z.string().max(50000);
const status = z.enum(["draft", "published", "archived"]);
const urlOrPath = z
  .string()
  .max(1000)
  .refine((v) => !v.includes("://") || /^https:\/\//.test(v), "HTTPS required")
  .refine((v) => !isYouTube(v) || !!youtubeId(v), "Invalid YouTube link")
  .nullable();
const base = {
  access_tier: z.enum(["free", "premium"]).optional(),
  description: text.optional(),
  title,
  status: status.default("draft"),
};
export const contentSchemas = {
  courses: z.object({ ...base, description: text.default("") }),
  course_modules: z.object({
    course_id: uuid,
    title,
    position: z.number().int().min(0).default(0),
  }),
  lessons: z.object({
    ...base,
    module_id: uuid,
    body: text,
    video_url: urlOrPath.optional(),
    position: z.number().int().min(0).default(0),
  }),
  lesson_resources: z.object({
    lesson_id: uuid,
    title,
    storage_path: z.string().min(1).max(1000),
  }),
  tests: z.object({
    ...base,
    skill: z.enum(["listening", "reading"]),
    variant: z.enum(["academic", "general"]).default("academic"),
    duration_seconds: z.number().int().min(60).max(14400),
    band_thresholds: z
      .array(
        z.object({
          min: z.number().int().min(0),
          band: z.number().min(0).max(9).multipleOf(0.5),
        }),
      )
      .min(1)
      .nullable()
      .optional(),
  }),
  test_sections: z.object({
    test_id: uuid,
    title,
    audio_path: z.string().max(1000).nullable().optional(),
    position: z.number().int().min(0).default(0),
  }),
  passages: z.object({
    attachment_path: z.string().max(1000).nullable().optional(),
    section_id: uuid,
    title: title.default("Passage"),
    body: text,
  }),
  questions: z.object({
    section_id: uuid,
    prompt: title,
    kind: z.enum([
      "text",
      "choice",
      "true_false_not_given",
      "yes_no_not_given",
      "matching",
      "multiple_choice",
    ]),
    position: z.number().int().min(0),
    max_words: z.number().int().min(1).nullable().optional(),
    points: z.number().int().min(1).max(10).default(1),
  }),
  question_options: z.object({ question_id: uuid, label: title, value: title }),
  answer_keys: z.object({
    question_id: uuid,
    accepted: z.array(title).min(1),
    explanation: text.default(""),
  }),
  writing_tasks: z.object({
    suggested_words: z.number().int().min(50).max(1000).optional(),
    ...base,
    prompt: text.min(1),
    task_number: z.union([z.literal(1), z.literal(2)]),
    image_path: z.string().max(1000).nullable().optional(),
    duration_seconds: z.number().int().min(60).max(7200).default(2400),
  }),
  speaking_tasks: z.object({
    media_path: z.string().max(1000).nullable().optional(),
    ...base,
    prompt: text.min(1),
    part: z.number().int().min(1).max(3),
    preparation_seconds: z.number().int().min(0).max(300).default(60),
    response_seconds: z.number().int().min(10).max(600).default(120),
  }),
  mock_exams: z.object({
    ...base,
    allow_resume: z.boolean().default(true),
    available_from: z.iso.datetime().nullable().optional(),
    available_until: z.iso.datetime().nullable().optional(),
  }),
  mock_exam_sections: z.object({
    mock_exam_id: uuid,
    skill: z.enum(["listening", "reading", "writing", "speaking"]),
    test_id: uuid.nullable().optional(),
    writing_task_id: uuid.nullable().optional(),
    speaking_task_id: uuid.nullable().optional(),
    position: z.number().int().min(0),
  }),
};
export const onboardingSchema = z
  .object({
    motivation: z
      .enum([
        "study_abroad",
        "university",
        "career",
        "immigration",
        "personal",
        "other",
      ])
      .optional(),
    target_band: z.number().min(5.5).max(9).multipleOf(0.5).optional(),
    current_level: z
      .enum([
        "beginner",
        "elementary",
        "intermediate",
        "upper_intermediate",
        "advanced",
        "unknown",
      ])
      .optional(),
    priority_skills: z
      .array(z.enum(["listening", "reading", "writing", "speaking"]))
      .min(1)
      .max(4)
      .optional(),
    daily_goal_minutes: z.number().int().min(5).max(240).optional(),
    weekly_availability: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .max(7)
      .optional(),
    current_step: z.number().int().min(0).max(8).optional(),
  })
  .strict();
export const evaluationSchema = z
  .object({
    criteria: z
      .object({
        task_response: z.number().min(0).max(9).multipleOf(0.5),
        coherence: z.number().min(0).max(9).multipleOf(0.5),
        lexical: z.number().min(0).max(9).multipleOf(0.5),
        grammar: z.number().min(0).max(9).multipleOf(0.5),
      })
      .strict(),
    feedback: z.string().min(1).max(12000),
    grammar_feedback: z.string().max(5000),
    vocabulary_feedback: z.string().max(5000),
    improvements: z.array(z.string().max(1000)).min(1).max(10),
  })
  .strict();
export const speakingFeedbackSchema = z
  .object({
    feedback: z.string().min(1).max(12000),
    improvements: z.array(z.string()).min(1).max(10),
  })
  .strict();
export function bandAverage(values: number[]) {
  return (
    Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 2) / 2
  );
}
export function roleDestination(roles: string[], completed: boolean) {
  return roles.includes("ADMIN")
    ? "/admin"
    : roles.includes("TEACHER")
      ? "/teacher"
      : completed
        ? "/dashboard"
        : "/onboarding";
}

export const writingCriteria = z
  .object({
    task_response: z.number().min(0).max(9).multipleOf(0.5),
    coherence: z.number().min(0).max(9).multipleOf(0.5),
    lexical: z.number().min(0).max(9).multipleOf(0.5),
    grammar: z.number().min(0).max(9).multipleOf(0.5),
  })
  .strict();
export const speakingCriteria = z
  .object({
    fluency: z.number().min(0).max(9).multipleOf(0.5),
    lexical: z.number().min(0).max(9).multipleOf(0.5),
    grammar: z.number().min(0).max(9).multipleOf(0.5),
    pronunciation: z.number().min(0).max(9).multipleOf(0.5),
  })
  .strict();
