import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
const container = process.env.TEST_DB_CONTAINER || "ielts-db";
function sql(source: string, db = "academy_test") {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      db,
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: source, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}
const student = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002",
  admin = "10000000-0000-4000-8000-000000000003",
  teacher = "10000000-0000-4000-8000-000000000004";
const test = "20000000-0000-4000-8000-000000000001",
  section = "20000000-0000-4000-8000-000000000002",
  q = "20000000-0000-4000-8000-000000000003";
function asUser(id: string, query: string) {
  return sql(
    `begin;set local role authenticated;select set_config('request.jwt.claim.sub','${id}',true);${query};commit;`,
  );
}
const suite = process.env.RUN_DB_TESTS ? describe : describe.skip;
suite("PostgreSQL migrations, RLS and transactional workflows", () => {
  beforeAll(() => {
    sql(
      "drop database if exists academy_test;create database academy_test",
      "postgres",
    );
    sql(`do $$ begin create role anon nologin;exception when duplicate_object then null;end $$;do $$ begin create role authenticated nologin;exception when duplicate_object then null;end $$;do $$ begin create role service_role nologin bypassrls;exception when duplicate_object then null;end $$;
  create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now(),raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;
  create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;grant execute on function storage.foldername(text) to authenticated;`);
    for (const file of readdirSync("supabase/migrations").sort())
      sql(readFileSync("supabase/migrations/" + file, "utf8"));
  }, 30000);
  it("initializes no educational content or fake student activity", () => {
    expect(
      sql(
        `select (select count(*) from courses)+(select count(*) from tests)+(select count(*) from test_attempts)+(select count(*) from student_achievements)`,
      ),
    ).toBe("0");
  });
  it("enables RLS on every public table", () => {
    expect(
      sql(
        "select count(*) from pg_tables where schemaname='public' and not rowsecurity",
      ),
    ).toBe("0");
  });
  it("provisions only student role regardless of metadata", () => {
    sql(
      `insert into auth.users(id,email,raw_user_meta_data) values('${student}','a@example.test','{"role":"ADMIN","name":"Student"}'),('${other}','b@example.test','{}'),('${admin}','c@example.test','{}'),('${teacher}','d@example.test','{}');insert into user_roles values('${admin}','ADMIN'),('${teacher}','TEACHER');`,
    );
    expect(
      sql(
        `select string_agg(role,',') from user_roles where user_id='${student}'`,
      ),
    ).toBe("STUDENT");
  });
  it("denies self role escalation and forged results", () => {
    expect(() =>
      asUser(student, `insert into user_roles values('${student}','ADMIN')`),
    ).toThrow();
    expect(() =>
      asUser(
        student,
        `insert into learning_activity_events(user_id,kind,source_id) values('${student}','test',gen_random_uuid())`,
      ),
    ).toThrow();
    expect(() =>
      asUser(student, `select record_activity('test',gen_random_uuid())`),
    ).toThrow();
  });
  it("validates, resumes and idempotently completes onboarding", () => {
    asUser(
      student,
      `select save_onboarding('{"motivation":"career","current_step":1}',false)`,
    );
    expect(
      sql(
        `select current_step from student_onboarding where user_id='${student}'`,
      ),
    ).toBe("1");
    expect(() =>
      asUser(student, `select save_onboarding('{}',true)`),
    ).toThrow();
    asUser(
      student,
      `select save_onboarding('{"target_band":7.5,"current_level":"intermediate","priority_skills":["reading"],"daily_goal_minutes":30,"weekly_availability":[1,3],"current_step":8}',true);select save_onboarding('{}',true)`,
    );
    expect(
      sql(
        `select count(*) from student_achievements where user_id='${student}'`,
      ),
    ).toBe("1");
    expect(asUser(other, `select count(*) from student_onboarding`)).toContain(
      "\n0\n",
    );
  });
  it("rejects publishing tests without questions and keys", () => {
    asUser(
      admin,
      `insert into tests(id,title,skill,duration_seconds) values('${test}','Fixture','reading',600)`,
    );
    expect(() =>
      asUser(admin, `update tests set status='published' where id='${test}'`),
    ).toThrow();
    asUser(
      admin,
      `insert into test_sections(id,test_id,title) values('${section}','${test}','Section');insert into questions(id,section_id,prompt,kind,max_words) values('${q}','${section}','Answer','text',2);insert into answer_keys values('${q}',array['New York'],'Explanation');update tests set band_thresholds='[{"min":0,"band":0},{"min":1,"band":6}]',status='published' where id='${test}'`,
    );
  });
  it("hides private answer keys even when a test is published", () => {
    expect(asUser(student, "select count(*) from answer_keys")).toContain(
      "\n0\n",
    );
  });
  it("resumes attempts, autosaves and marks only on server", () => {
    asUser(
      student,
      `select start_test('${test}');select start_test('${test}')`,
    );
    expect(
      sql(`select count(*) from test_attempts where user_id='${student}'`),
    ).toBe("1");
    const id = sql(`select id from test_attempts where user_id='${student}'`);
    asUser(
      student,
      `select save_answers('${id}','{"${q}":"  NEW   YORK "}');select submit_test('${id}');select submit_test('${id}')`,
    );
    expect(
      sql(
        `select raw_score||'/'||total_points||':'||band from test_attempts where id='${id}'`,
      ),
    ).toBe("1/1:6.0");
    expect(
      sql(`select count(*) from learning_activity_events where kind='test'`),
    ).toBe("1");
    expect(() =>
      asUser(student, `select save_answers('${id}','{}')`),
    ).toThrow();
  });
  it("prevents cross-user submission and reading attempts", () => {
    const id = sql(`select id from test_attempts limit 1`);
    expect(() => asUser(other, `select submit_test('${id}')`)).toThrow();
    expect(asUser(other, "select count(*) from test_attempts")).toContain(
      "\n0\n",
    );
  });
  it("freezes content with existing attempts", () => {
    expect(() =>
      asUser(admin, `update questions set prompt='Changed' where id='${q}'`),
    ).toThrow();
  });
  it("rejects answer saves after a server deadline", () => {
    asUser(other, `select start_test('${test}')`);
    const id = sql(`select id from test_attempts where user_id='${other}'`);
    sql(
      `update test_attempts set deadline=now()-interval '1 second' where id='${id}'`,
    );
    expect(() =>
      asUser(other, `select save_answers('${id}','{"${q}":"New York"}')`),
    ).toThrow();
    asUser(other, `select submit_test('${id}')`);
    expect(sql(`select raw_score from test_attempts where id='${id}'`)).toBe(
      "0",
    );
  });
  it("authorizes only assigned teachers to review submitted work", () => {
    const task = "30000000-0000-4000-8000-000000000001";
    asUser(
      admin,
      `insert into writing_tasks(id,title,prompt,task_number) values('${task}','Task','Prompt',2);update writing_tasks set status='published' where id='${task}'`,
    );
    asUser(
      student,
      `select writing_draft('${task}','Real fixture response',true)`,
    );
    const id = sql("select id from writing_submissions limit 1");
    expect(() =>
      asUser(
        teacher,
        `select review_submission('writing','${id}',7,'{}','Feedback')`,
      ),
    ).toThrow();
    asUser(
      admin,
      `insert into teacher_student_assignments(teacher_id,student_id) values('${teacher}','${student}')`,
    );
    asUser(
      teacher,
      `select review_submission('writing','${id}',7,'{}','Teacher feedback')`,
    );
    expect(sql("select count(*) from writing_evaluations")).toBe("1");
  });
  it("enforces consent and atomic daily AI limits", () => {
    const id = sql("select id from writing_submissions limit 1");
    asUser(
      admin,
      "update platform_settings set ai_enabled=true,ai_daily_user_limit=1",
    );
    expect(() =>
      asUser(student, `select reserve_ai('writing','${id}','test-model')`),
    ).toThrow();
    asUser(
      student,
      `update user_preferences set ai_consent=true where user_id='${student}';select reserve_ai('writing','${id}','test-model')`,
    );
    expect(() =>
      asUser(student, `select reserve_ai('writing','${id}','test-model')`),
    ).toThrow();
  });
  it("restricts first-admin bootstrap to service execution and a verified account", () => {
    expect(() =>
      asUser(student, `select provision_first_admin('a@example.test')`),
    ).toThrow();
    expect(() =>
      sql(`select provision_first_admin('c@example.test')`),
    ).toThrow();
    sql(`delete from user_roles where role='ADMIN'`);
    sql(
      `set role service_role;select provision_first_admin('c@example.test');reset role`,
    );
    expect(
      sql(
        `select count(*) from user_roles where role='ADMIN' and user_id='${admin}'`,
      ),
    ).toBe("1");
  });
  it("rejects unauthorized role changes and preserves the final administrator", () => {
    expect(() =>
      asUser(student, `select change_role('${student}','ADMIN',false)`),
    ).toThrow();
    expect(() =>
      asUser(admin, `select change_role('${admin}','ADMIN',true)`),
    ).toThrow();
    asUser(
      admin,
      `select change_role('${other}','TEACHER',false);select change_role('${other}','TEACHER',true)`,
    );
    expect(
      sql(
        `select count(*) from user_roles where user_id='${other}' and role='TEACHER'`,
      ),
    ).toBe("0");
  });
  it("keeps writing submission retries idempotent", () => {
    const id = sql("select id from writing_submissions limit 1");
    const task = sql("select task_id from writing_submissions limit 1");
    asUser(
      student,
      `select writing_draft('${task}','Another response',true,'${id}');select writing_draft('${task}','Another response',true,'${id}')`,
    );
    expect(sql("select count(*) from writing_submissions")).toBe("1");
  });
  it("prevents publishing incomplete mocks and hides other students scorecards", () => {
    const m = "40000000-0000-4000-8000-000000000001";
    asUser(
      admin,
      `insert into mock_exams(id,title) values('${m}','Isolated mock fixture')`,
    );
    expect(() =>
      asUser(admin, `update mock_exams set status='published' where id='${m}'`),
    ).toThrow();
    expect(() => asUser(other, `select mock_scorecard('${m}')`)).toThrow();
  });
  it("completes four mock sections and waits for genuine subjective reviews", () => {
    const m = "40000000-0000-4000-8000-000000000001",
      listening = "50000000-0000-4000-8000-000000000001",
      ls = "50000000-0000-4000-8000-000000000002",
      lq = "50000000-0000-4000-8000-000000000003",
      speaking = "50000000-0000-4000-8000-000000000004";
    const wt = sql("select id from writing_tasks limit 1");
    asUser(
      admin,
      `insert into tests(id,title,skill,duration_seconds,band_thresholds) values('${listening}','Listening fixture','listening',600,'[{"min":0,"band":0},{"min":1,"band":6}]');insert into test_sections(id,test_id,title) values('${ls}','${listening}','Section');insert into questions(id,section_id,prompt,kind) values('${lq}','${ls}','Question','text');insert into answer_keys values('${lq}',array['answer'],'');update tests set status='published' where id='${listening}';insert into speaking_tasks(id,title,prompt,part) values('${speaking}','Speaking fixture','Response',2);update speaking_tasks set status='published' where id='${speaking}';
      insert into mock_exam_sections(mock_exam_id,skill,test_id,position) values('${m}','listening','${listening}',0),('${m}','reading','${test}',1);insert into mock_exam_sections(mock_exam_id,skill,writing_task_id,position) values('${m}','writing','${wt}',2);insert into mock_exam_sections(mock_exam_id,skill,speaking_task_id,position) values('${m}','speaking','${speaking}',3);update mock_exams set status='published' where id='${m}'`,
    );
    asUser(student, `select start_mock('${m}')`);
    const ma = sql(
      `select id from mock_exam_attempts where mock_exam_id='${m}'`,
    );
    for (const [t, question, answer, skill] of [
      [listening, lq, "answer", "listening"],
      [test, q, "New York", "reading"],
    ]) {
      asUser(student, `select start_test('${t}')`);
      const a = sql(
        `select id from test_attempts where user_id='${student}' and test_id='${t}' and status='in_progress'`,
      );
      const ms = sql(
        `select id from mock_exam_sections where mock_exam_id='${m}' and skill='${skill}'`,
      );
      asUser(
        student,
        `select save_answers('${a}','{"${question}":"${answer}"}');select submit_test('${a}');select link_mock_section('${ma}','${ms}','${a}')`,
      );
    }
    asUser(student, `select writing_draft('${wt}','A new mock response',true)`);
    const w = sql(
      "select id from writing_submissions order by created_at desc limit 1",
    );
    const ws = sql(
      `select id from mock_exam_sections where mock_exam_id='${m}' and skill='writing'`,
    );
    asUser(
      student,
      `select link_mock_section('${ma}','${ws}','${w}');insert into storage.objects(bucket_id,name) values('speaking','${student}/mock.webm')`,
    );
    sql(
      `insert into media_assets(user_id,bucket,storage_path,mime_type,size_bytes) values('${student}','speaking','${student}/mock.webm','audio/webm',100)`,
    );
    asUser(
      student,
      `select add_recording('${speaking}','${student}/mock.webm')`,
    );
    const r = sql(
        `select id from speaking_recordings where task_id='${speaking}'`,
      ),
      ss = sql(
        `select id from mock_exam_sections where mock_exam_id='${m}' and skill='speaking'`,
      );
    asUser(student, `select link_mock_section('${ma}','${ss}','${r}')`);
    expect(
      sql(
        `select submitted_at is not null from mock_exam_attempts where id='${ma}'`,
      ),
    ).toBe("t");
    expect(JSON.parse(sql(`select mock_scorecard('${ma}')`)).overall_band).toBe(
      null,
    );
    asUser(
      teacher,
      `select review_submission('writing','${w}',7,'{}','Reviewed writing');select review_submission('speaking','${r}',7,'{}','Reviewed audio')`,
    );
    expect(JSON.parse(sql(`select mock_scorecard('${ma}')`)).overall_band).toBe(
      6.5,
    );
    expect(() => asUser(other, `select mock_scorecard('${ma}')`)).toThrow();
  });
  it("denies access to other students private recordings", () => {
    expect(() =>
      asUser(
        other,
        `insert into storage.objects(bucket_id,name) values('speaking','${student}/forged.webm')`,
      ),
    ).toThrow();
  });
});
