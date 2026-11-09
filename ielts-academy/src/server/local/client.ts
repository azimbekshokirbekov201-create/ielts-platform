/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { prisma } from "./database";
import { Store, ApiError, type Row } from "./engine";
import { hashPassword, verifyPassword, digest } from "./password";
export { ApiError };
const relations: Record<string, Record<string, [string, string, boolean]>> = {
  courses: { course_modules: ["course_modules", "course_id", true] },
  course_modules: { lessons: ["lessons", "module_id", true] },
  lessons: { lesson_resources: ["lesson_resources", "lesson_id", true] },
  tests: { test_sections: ["test_sections", "test_id", true] },
  test_sections: {
    passages: ["passages", "section_id", true],
    questions: ["questions", "section_id", true],
  },
  questions: { question_options: ["question_options", "question_id", true] },
  test_attempts: {
    student_answers: ["student_answers", "attempt_id", true],
    tests: ["tests", "test_id", false],
  },
  writing_submissions: {
    writing_tasks: ["writing_tasks", "task_id", false],
    writing_evaluations: ["writing_evaluations", "submission_id", true],
  },
  speaking_recordings: {
    speaking_tasks: ["speaking_tasks", "task_id", false],
    speaking_evaluations: ["speaking_evaluations", "recording_id", true],
    speaking_transcripts: ["speaking_transcripts", "recording_id", true],
  },
  mock_exams: {
    mock_exam_sections: ["mock_exam_sections", "mock_exam_id", true],
  },
  mock_exam_attempts: {
    mock_exams: ["mock_exams", "mock_exam_id", false],
    mock_exam_results: ["mock_exam_results", "attempt_id", true],
  },
  profiles: {
    user_roles: ["user_roles", "user_id", true],
    lesson_progress: ["lesson_progress", "user_id", true],
    test_attempts: ["test_attempts", "user_id", true],
  },
  assignments: { tests: ["tests", "test_id", false] },
};
function fields(s: string) {
  let depth = 0,
    start = 0;
  const list: string[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    if (s[i] === ")") depth--;
    if (s[i] === "," && !depth) {
      list.push(s.slice(start, i));
      start = i + 1;
    }
  }
  list.push(s.slice(start));
  return list;
}
async function project(
  store: Store,
  kind: string,
  row: Row,
  select: string,
): Promise<Row> {
  const out: Row = {};
  for (const f of fields(select)) {
    if (f === "*") Object.assign(out, row);
    else if (f.includes("(")) {
      const name = f.slice(0, f.indexOf("(")),
        inner = f.slice(f.indexOf("(") + 1, -1),
        rel = relations[kind]?.[name];
      if (!rel) continue;
      const candidates = (await store.all(rel[0])).filter((x) =>
        rel[2] ? x[rel[1]] === row.id : x.id === row[rel[1]],
      );
      const visible = [];
      for (const x of candidates)
        if (await store.visible(rel[0], x))
          visible.push(await project(store, rel[0], x, inner));
      out[name] = rel[2] ? visible : visible[0] || null;
    } else out[f] = row[f];
  }
  return out;
}
class Query {
  filters: ((r: Row) => boolean)[] = [];
  selection = "*";
  mode = "read";
  input: Row = {};
  one = false;
  optional = false;
  offset = 0;
  size = 1000;
  sort?: [string, boolean];
  conflict?: string;
  constructor(
    public store: Store,
    public kind: string,
  ) {}
  select(s = "*") {
    this.selection = s;
    return this;
  }
  eq(k: string, v: unknown) {
    this.filters.push((r) => String(r[k]) === String(v));
    return this;
  }
  neq(k: string, v: unknown) {
    this.filters.push((r) => r[k] !== v);
    return this;
  }
  order(k: string, o: Row = {}) {
    this.sort = [k, o.ascending !== false];
    return this;
  }
  range(a: number, b: number) {
    this.offset = a;
    this.size = b - a + 1;
    return this;
  }
  limit(n: number) {
    this.size = n;
    return this;
  }
  single() {
    this.one = true;
    return this;
  }
  maybeSingle() {
    this.one = true;
    this.optional = true;
    return this;
  }
  insert(p: Row) {
    this.mode = "insert";
    this.input = p;
    return this;
  }
  upsert(p: Row, options: Row = {}) {
    this.mode = "upsert";
    this.input = p;
    this.conflict = options.onConflict;
    return this;
  }
  update(p: Row) {
    this.mode = "update";
    this.input = p;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  async execute(store = this.store) {
    let rows = (await store.all(this.kind)).filter((r) =>
      this.filters.every((f) => f(r)),
    );
    if (this.mode === "read") {
      const allowed = [];
      for (const r of rows)
        if (await store.visible(this.kind, r)) allowed.push(r);
      rows = allowed;
    } else if (this.mode === "insert" || this.mode === "upsert") {
      let old: Row | undefined;
      if (this.mode === "upsert") {
        const fields = (this.conflict || "id").split(",");
        old = rows.find((r) =>
          fields.every(
            (k) => this.input[k] !== undefined && r[k] === this.input[k],
          ),
        );
      }
      rows = [await store.mutate(this.kind, this.mode, this.input, old)];
    } else {
      const changed = [];
      for (const r of rows)
        changed.push(await store.mutate(this.kind, this.mode, this.input, r));
      rows = changed;
    }
    if (this.sort) {
      const [key, asc] = this.sort;
      rows.sort(
        (a, b) =>
          (typeof a[key] === "number" && typeof b[key] === "number"
            ? a[key] - b[key]
            : String(a[key]).localeCompare(String(b[key]))) * (asc ? 1 : -1),
      );
    }
    rows = rows.slice(this.offset, this.offset + this.size);
    const data = [];
    for (const r of rows)
      data.push(await project(store, this.kind, r, this.selection));
    if (this.one && !data.length && !this.optional)
      throw new ApiError(404, "not_found");
    return { data: this.one ? data[0] || null : data, error: null };
  }
  then(resolve: (v: any) => any, reject?: (e: any) => any) {
    const job =
      this.mode === "read"
        ? this.execute()
        : prisma.$transaction(
            (tx) =>
              this.execute(
                new Store(tx, this.store.uid, this.store.privileged),
              ),
            { timeout: 15000 },
          );
    return job.catch((error) => ({ data: null, error })).then(resolve, reject);
  }
}
export function privatePath(bucket: string, path: string) {
  if (
    !["speaking", "course-media"].includes(bucket) ||
    !/^[-a-zA-Z0-9]+\/[-a-zA-Z0-9][-.a-zA-Z0-9]*$/.test(path)
  )
    throw new ApiError(400, "invalid_file");
  return resolve(
    process.env.PRIVATE_UPLOAD_DIR || "private-uploads",
    bucket,
    path,
  );
}
export async function mediaAllowed(store: Store, bucket: string, path: string) {
  if (await store.admin()) return true;
  if (
    bucket === "course-media" &&
    path.split("/")[0] === store.uid &&
    (await store.author())
  )
    return true;
  if (!store.uid) return false;
  if (bucket === "speaking") {
    if (path.split("/")[0] === store.uid) return true;
    return (
      (await store.all("speaking_recordings")).some(
        (x) => x.storage_path === path,
      ) &&
      (await store.review(
        (await store.all("speaking_recordings")).find(
          (x) => x.storage_path === path,
        )!.user_id,
      ))
    );
  }
  for (const [kind, field] of [
    ["lessons", "video_url"],
    ["passages", "attachment_path"],
    ["speaking_tasks", "media_path"],
    ["lesson_resources", "storage_path"],
    ["test_sections", "audio_path"],
    ["writing_tasks", "image_path"],
  ])
    for (const r of await store.all(kind))
      if (r[field] === path && (await store.visible(kind, r))) return true;
  return false;
}
function storage(store: Store, bucket: string) {
  return {
    async createSignedUploadUrl(path: string) {
      if (
        !store.uid ||
        path.split("/")[0] !== store.uid ||
        (bucket === "course-media" && !(await store.author()))
      )
        return { error: new ApiError(403, "forbidden"), data: null };
      privatePath(bucket, path);
      return {
        data: { signedUrl: "/api/local-media/" + bucket + "/" + path },
        error: null,
      };
    },
    async createSignedUrl(path: string) {
      if (!(await mediaAllowed(store, bucket, path)))
        return { data: null, error: new ApiError(403, "forbidden") };
      privatePath(bucket, path);
      return {
        data: { signedUrl: "/api/local-media/" + bucket + "/" + path },
        error: null,
      };
    },
    async upload(path: string, file: Blob, options: Row) {
      try {
        if (
          path.split("/")[0] !== store.uid ||
          (bucket === "course-media" && !(await store.author()))
        )
          throw new ApiError(403, "forbidden");
        const target = privatePath(bucket, path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, Buffer.from(await file.arrayBuffer()), {
          flag: "wx",
          mode: 0o600,
        });
        await new Store(prisma, null, true).put("upload_metadata", {
          id: bucket + ":" + path,
          bucket,
          path,
          type: options.contentType,
        });
        return { data: { path }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    async download(path: string) {
      try {
        if (!(await mediaAllowed(store, bucket, path)))
          throw new ApiError(403, "forbidden");
        const meta = await store.get("upload_metadata", bucket + ":" + path);
        const bytes = await readFile(privatePath(bucket, path));
        return {
          data: new Blob([bytes], {
            type: meta?.type || "application/octet-stream",
          }),
          error: null,
        };
      } catch (error) {
        return { data: null, error };
      }
    },
  };
}
export function client(store: Store) {
  return {
    from: (kind: string) => new Query(store, kind),
    rpc: async (name: string, p: Row) => {
      try {
        return {
          data: await prisma.$transaction(
            (tx) => new Store(tx, store.uid, store.privileged).rpc(name, p),
            { timeout: 15000 },
          ),
          error: null,
        };
      } catch (error) {
        return { data: null, error };
      }
    },
    storage: { from: (bucket: string) => storage(store, bucket) },
  };
}
const cookieName = "academy_session";
export async function sessionUser(token: string | undefined) {
  if (!token) return null;
  const s = await prisma.session.findUnique({
    where: { tokenHash: digest(token) },
    include: { account: true },
  });
  return s && s.expiresAt.getTime() > Date.now()
    ? { id: s.account.id, email: s.account.email }
    : null;
}
export async function registerAccount(
  email: string,
  password: string,
  name: string,
) {
  const passwordHash = await hashPassword(password);
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: { email: email.toLowerCase(), passwordHash },
    });
    const s = new Store(tx, account.id, true);
    await s.put("profiles", {
      id: account.id,
      display_name: name,
      created_at: new Date().toISOString(),
    });
    await s.put("user_roles", {
      id: account.id + ":STUDENT",
      user_id: account.id,
      role: "STUDENT",
    });
    await s.put("user_preferences", {
      id: account.id,
      user_id: account.id,
      language: "en",
      theme: "light",
      ai_consent: false,
    });
    return { id: account.id, email: account.email };
  });
}
export async function authenticate(email: string, password: string) {
  const a = await prisma.account.findUnique({
    where: { email: email.toLowerCase() },
  });
  const hash = a?.passwordHash || `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;
  if (!(await verifyPassword(password, hash)) || !a)
    throw new ApiError(401, "auth_failed");
  return { id: a.id, email: a.email };
}
export async function userDb() {
  const jar = await cookies();
  let user = await sessionUser(jar.get(cookieName)?.value);
  const store = new Store(prisma, user?.id || null);
  const setSession = async (u: { id: string; email: string }) => {
    const old = jar.get(cookieName)?.value;
    if (old)
      await prisma.session.deleteMany({ where: { tokenHash: digest(old) } });
    const token = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: {
        tokenHash: digest(token),
        accountId: u.id,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    jar.set(cookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.SESSION_COOKIE_SECURE
        ? process.env.SESSION_COOKIE_SECURE === "true"
        : process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 86400,
    });
    user = u;
    store.uid = u.id;
  };
  const auth = {
    getUser: async () => ({ data: { user }, error: null }),
    signUp: async (p: Row) => {
      try {
        const u = await registerAccount(
          p.email,
          p.password,
          p.options.data.name,
        );
        await setSession(u);
        return { data: { user: u, session: true }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    signInWithPassword: async (p: Row) => {
      try {
        const u = await authenticate(p.email, p.password);
        await setSession(u);
        return { data: { user: u, session: true }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    signOut: async () => {
      const token = jar.get(cookieName)?.value;
      if (token)
        await prisma.session.deleteMany({
          where: { tokenHash: digest(token) },
        });
      jar.delete(cookieName);
      user = null;
      store.uid = null;
      return { error: null };
    },
    updateUser: async (p: Row) => {
      if (!user) return { error: new ApiError(401, "unauthorized") };
      await prisma.$transaction(async (tx) => {
        await tx.account.update({
          where: { id: user!.id },
          data: { passwordHash: await hashPassword(p.password) },
        });
        await tx.session.deleteMany({ where: { accountId: user!.id } });
      });
      await setSession(user);
      return { data: { user }, error: null };
    },
    resetPasswordForEmail: async () => {
      throw new ApiError(503, "password_recovery_unavailable");
    },
    exchangeCodeForSession: async () => ({
      error: new ApiError(400, "auth_failed"),
    }),
  };
  return { ...client(store), auth } as unknown as SupabaseClient;
}
export function serviceDb() {
  return client(new Store(prisma, null, true)) as unknown as SupabaseClient;
}
