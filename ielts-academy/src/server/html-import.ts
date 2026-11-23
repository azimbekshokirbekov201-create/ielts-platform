/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "./local/database";
import { ApiError, Store, type Row } from "./local/engine";
import { parseInteractive } from "./html-import-dom";

/**
 * Computer-delivered IELTS (CDI) HTML importer.
 *
 * Test data embedded in an HTML page as JavaScript object literals
 * (`const PASSAGES = {...}`, `const SECTIONS = {...}`) is read with a small literal parser.
 * Uploaded code is never executed: anything that is not a plain literal is rejected.
 */

// ---------- JavaScript literal parser (no eval) ----------
class Literal {
  i: number;
  constructor(
    private s: string,
    start: number,
  ) {
    this.i = start;
  }
  private fail(message: string): never {
    throw new Error(message + " (position " + this.i + ")");
  }
  private ws() {
    for (;;) {
      const c = this.s[this.i];
      if (c === undefined) return;
      if (/\s/.test(c)) this.i++;
      else if (c === "/" && this.s[this.i + 1] === "/") {
        while (this.i < this.s.length && this.s[this.i] !== "\n") this.i++;
      } else if (c === "/" && this.s[this.i + 1] === "*") {
        const end = this.s.indexOf("*/", this.i + 2);
        if (end < 0) this.fail("Unterminated comment");
        this.i = end + 2;
      } else return;
    }
  }
  run() {
    const value = this.value(0);
    return { value, end: this.i };
  }
  private value(depth: number): unknown {
    if (depth > 64) this.fail("Data is nested too deeply");
    this.ws();
    const c = this.s[this.i];
    if (c === "{") return this.object(depth);
    if (c === "[") return this.array(depth);
    if (c === '"' || c === "'" || c === "`") return this.concat();
    const number = /[-+]?(?:0x[\da-f]+|\d+\.?\d*(?:e[-+]?\d+)?|\.\d+)/iy;
    number.lastIndex = this.i;
    const n = number.exec(this.s);
    if (n) {
      this.i += n[0].length;
      return Number(n[0]);
    }
    const word = /[A-Za-z_$][\w$]*/y;
    word.lastIndex = this.i;
    const w = word.exec(this.s);
    if (w) {
      const literals: Record<string, unknown> = {
        true: true,
        false: false,
        null: null,
        undefined: null,
        NaN: null,
      };
      if (w[0] in literals) {
        this.i += w[0].length;
        return literals[w[0]];
      }
    }
    return this.fail("Only plain data is supported, found code");
  }
  private concat(): string {
    let out = this.string();
    for (;;) {
      const save = this.i;
      this.ws();
      if (this.s[this.i] === "+") {
        this.i++;
        this.ws();
        const q = this.s[this.i];
        if (q !== '"' && q !== "'" && q !== "`")
          this.fail("Unsupported expression");
        out += this.string();
      } else {
        this.i = save;
        return out;
      }
    }
  }
  private string(): string {
    const quote = this.s[this.i++];
    let out = "";
    for (;;) {
      const c = this.s[this.i++];
      if (c === undefined) this.fail("Unterminated string");
      if (c === quote) return out;
      if (quote === "`" && c === "$" && this.s[this.i] === "{")
        this.fail("Template expressions are not supported");
      if (c !== "\\") {
        out += c;
        continue;
      }
      const e = this.s[this.i++];
      if (e === "n") out += "\n";
      else if (e === "t") out += "\t";
      else if (e === "r") out += "\r";
      else if (e === "b") out += "\b";
      else if (e === "f") out += "\f";
      else if (e === "v") out += "\v";
      else if (e === "0") out += "\0";
      else if (e === "\n") continue;
      else if (e === "\r") {
        if (this.s[this.i] === "\n") this.i++;
      } else if (e === "u") {
        const braced = /\{([\da-f]+)\}/iy;
        braced.lastIndex = this.i;
        const b = braced.exec(this.s);
        if (b) {
          out += String.fromCodePoint(parseInt(b[1], 16));
          this.i += b[0].length;
        } else {
          const hex = this.s.slice(this.i, this.i + 4);
          if (!/^[\da-f]{4}$/i.test(hex)) this.fail("Bad unicode escape");
          out += String.fromCharCode(parseInt(hex, 16));
          this.i += 4;
        }
      } else if (e === "x") {
        const hex = this.s.slice(this.i, this.i + 2);
        if (!/^[\da-f]{2}$/i.test(hex)) this.fail("Bad escape");
        out += String.fromCharCode(parseInt(hex, 16));
        this.i += 2;
      } else out += e ?? "";
    }
  }
  private object(depth: number) {
    this.i++;
    const result: Record<string, unknown> = {};
    for (;;) {
      this.ws();
      const c = this.s[this.i];
      if (c === "}") {
        this.i++;
        return result;
      }
      let key: string;
      if (c === '"' || c === "'" || c === "`") key = this.string();
      else {
        const m = /[A-Za-z_$][\w$]*|\d+(?:\.\d+)?/y;
        m.lastIndex = this.i;
        const k = m.exec(this.s);
        if (!k) return this.fail("Expected a property name");
        key = k[0];
        this.i += key.length;
      }
      this.ws();
      if (this.s[this.i] !== ":") this.fail("Expected ':'");
      this.i++;
      const value = this.value(depth + 1);
      if (key !== "__proto__") result[key] = value;
      this.ws();
      if (this.s[this.i] === ",") this.i++;
      else if (this.s[this.i] !== "}") this.fail("Expected ',' or '}'");
    }
  }
  private array(depth: number) {
    this.i++;
    const result: unknown[] = [];
    for (;;) {
      this.ws();
      if (this.s[this.i] === "]") {
        this.i++;
        return result;
      }
      result.push(this.value(depth + 1));
      this.ws();
      if (this.s[this.i] === ",") this.i++;
      else if (this.s[this.i] !== "]") this.fail("Expected ',' or ']'");
    }
  }
}

export function extractLiterals(source: string) {
  const values: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const re =
    /(?:\b(?:const|let|var)\s+|\bwindow\.)([A-Za-z_$][\w$]*)\s*=\s*(?=[{[])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const name = m[1];
    if (name in values) continue;
    try {
      const r = new Literal(source, m.index + m[0].length).run();
      values[name] = r.value;
      re.lastIndex = r.end;
    } catch (e) {
      if (!(name in errors)) errors[name] = (e as Error).message;
    }
  }
  return { values, errors };
}

// ---------- HTML -> text (keeps paragraphs) ----------
const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  deg: "°",
  copy: "©",
  times: "×",
  middot: "·",
  bull: "•",
  eacute: "é",
};
function decode(text: string) {
  return text.replace(/&(#x?[\da-f]+|[a-z]+);/gi, (all, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1].toLowerCase() === "x"
          ? parseInt(e.slice(2), 16)
          : parseInt(e.slice(1), 10);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all;
    }
    return entities[e.toLowerCase()] ?? all;
  });
}
export function htmlToText(html: string) {
  return decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(
        /<\/(p|div|li|h[1-6]|tr|table|ul|ol|section|article|blockquote)\s*>/gi,
        "\n",
      )
      .replace(
        /<(p|div|li|h[1-6]|tr|section|article|blockquote)\b[^>]*>/gi,
        "\n",
      )
      .replace(/<[^>]*>/g, ""),
  )
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
const one = (v: unknown) =>
  htmlToText(String(v ?? "")).replace(/\s*\n\s*/g, " ");

// ---------- normalisation ----------
export type ParsedItem = {
  id: string;
  prompt: string;
  accepted: string[];
  options: { label: string; value: string }[];
  explanation: string;
};
export type ParsedGroup = {
  kind: string;
  maxWords: number | null;
  items: ParsedItem[];
};
export type ParsedPart = {
  title: string;
  body: string;
  groups: ParsedGroup[];
};
export type ParsedTest = {
  title: string;
  skill: "reading" | "listening";
  parts: ParsedPart[];
  warnings: string[];
  durationSeconds?: number;
};
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const entries = (v: unknown): [string, any][] => {
  if (Array.isArray(v)) return v.map((x, i) => [String(i + 1), x]);
  if (v && typeof v === "object")
    return Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
      /^\d+$/.test(a) && /^\d+$/.test(b) ? Number(a) - Number(b) : 0,
    );
  return [];
};
const pick = (obj: any, keys: string[]) => {
  for (const k of keys)
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  return undefined;
};
function kindOf(type: string) {
  const t = type.toLowerCase();
  if (/tfng|true.?false/.test(t)) return "true_false_not_given";
  if (/ynng|yes.?no/.test(t)) return "yes_no_not_given";
  if (/multi/.test(t) && !/matching/.test(t)) return "multiple_choice";
  if (/mcq|choice|radio|single/.test(t)) return "choice";
  if (/match|heading|people|feature|ending/.test(t)) return "matching";
  return "text";
}
function normalizeOptions(raw: unknown): { label: string; value: string }[] {
  return entries(raw).map(([index, o]) => {
    const n = Number(index) - 1;
    if (o && typeof o === "object") {
      const label = one(pick(o, ["text", "label", "name", "title", "content"]));
      const own = pick(o, ["value", "id", "letter", "key"]);
      const value =
        own !== undefined && String(own).length <= 20
          ? String(own)
          : (letters[n] ?? String(n + 1));
      return { label: label || value, value };
    }
    const text = one(o);
    const m = /^([A-Z])[.)]\s+(.*)$/s.exec(text);
    return m
      ? { label: m[2], value: m[1] }
      : { label: text, value: letters[n] ?? String(n + 1) };
  });
}
function answerList(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  return (Array.isArray(raw) ? raw : [raw]).map((x) => one(x)).filter(Boolean);
}
function normalizeTfng(answer: string, kind: string) {
  const a = answer.trim().toUpperCase().replace(/[_-]/g, " ");
  const yes = kind === "yes_no_not_given";
  if (a === "NG" || a === "NOT GIVEN") return "NOT GIVEN";
  if (a === "T" || a === "TRUE") return yes ? "YES" : "TRUE";
  if (a === "F" || a === "FALSE") return yes ? "NO" : "FALSE";
  if (a === "Y" || a === "YES") return "YES";
  if (a === "N" || a === "NO") return "NO";
  return a;
}
function findExplanation(expl: any, part: string, id: string) {
  const hit = expl?.[id] ?? expl?.[part]?.[id];
  if (hit === undefined || hit === null) return "";
  const text =
    typeof hit === "object"
      ? pick(hit, ["text", "explanation", "html", "content"])
      : hit;
  return htmlToText(String(text ?? "")).slice(0, 50000);
}

export function parseHtmlTest(
  source: string,
  hint?: "reading" | "listening",
): ParsedTest {
  const { values, errors } = extractLiterals(source);
  // Interactive exam pages (HTML questions + a KEY answer object) are read from the markup.
  const interactive = parseInteractive(source, values, hint);
  if (interactive) return interactive;
  const names = Object.keys(values);
  const find = (strict: RegExp, loose: RegExp) =>
    names.find((n) => strict.test(n)) ?? names.find((n) => loose.test(n));
  const passagesName = find(/^(?:[a-z]+_)?passages?$/i, /passage/i);
  const sectionsName = find(/^(?:[a-z]+_)?sections?$/i, /section|questions/i);
  const explName = find(/^(?:[a-z]+_)?explanations?$/i, /explanation/i);
  if (!sectionsName) {
    const failed = Object.keys(errors).find((n) => /section|question/i.test(n));
    throw new ApiError(
      400,
      "invalid_input",
      failed
        ? "reason_html_parse:" +
            failed +
            " — " +
            errors[failed].replace(/:/g, " ")
        : "reason_html_unrecognized:" +
            (Object.keys({ ...values, ...errors })
              .slice(0, 8)
              .join(", ") || "—"),
    );
  }
  const skill: "reading" | "listening" =
    hint ??
    (names.some((n) => /listening/i.test(n)) || /<audio\b/i.test(source)
      ? "listening"
      : "reading");
  const warnings: string[] = [];
  const passages = passagesName ? values[passagesName] : undefined;
  const sections = values[sectionsName];
  const expl = explName ? values[explName] : undefined;
  const passageByPart = new Map(entries(passages));
  // sections may be keyed by part, or be a flat list of groups that carry a part number
  const grouped = new Map<string, any[]>();
  for (const [key, value] of entries(sections)) {
    if (Array.isArray(value))
      grouped.set(key, [...(grouped.get(key) ?? []), ...value]);
    else if (
      value &&
      typeof value === "object" &&
      Array.isArray((value as any).groups)
    )
      grouped.set(key, [...(grouped.get(key) ?? []), ...(value as any).groups]);
    else if (value && typeof value === "object") {
      const part = String(pick(value, ["part", "passage", "section"]) ?? "1");
      grouped.set(part, [...(grouped.get(part) ?? []), value]);
    }
  }
  const partKeys = [
    ...new Set([...passageByPart.keys(), ...grouped.keys()]),
  ].sort((a, b) =>
    /^\d+$/.test(a) && /^\d+$/.test(b)
      ? Number(a) - Number(b)
      : a.localeCompare(b),
  );
  let images = 0;
  const parts: ParsedPart[] = partKeys.map((key) => {
    const passage = passageByPart.get(key);
    const rawBody =
      typeof passage === "string"
        ? passage
        : String(pick(passage, ["content", "body", "text", "html"]) ?? "");
    images += (rawBody.match(/<img\b/gi) || []).length;
    const headings = normalizeOptions(
      pick(passage, ["headings", "options"]) ?? [],
    );
    const groups: ParsedGroup[] = (grouped.get(key) ?? []).map((g) => {
      const type = String(pick(g, ["type", "kind", "format"]) ?? "fill");
      const kind = kindOf(type);
      const groupOptions = normalizeOptions(
        pick(g, [
          "options",
          "choices",
          "headings",
          "people",
          "features",
          "endings",
        ]) ?? [],
      );
      const maxWords =
        Number(pick(g, ["wordLimit", "maxWords", "max_words", "limit"])) ||
        null;
      const items = entries(pick(g, ["items", "questions"]) ?? []).map(
        ([index, it]): ParsedItem => {
          const id = String(pick(it, ["id", "number", "n", "no"]) ?? index);
          const useHeadings = /heading/i.test(type) && headings.length;
          const rawOptions = pick(it, ["options", "choices"]);
          const options =
            kind === "text" ||
            kind === "true_false_not_given" ||
            kind === "yes_no_not_given"
              ? []
              : useHeadings
                ? headings
                : rawOptions
                  ? normalizeOptions(rawOptions)
                  : groupOptions;
          let accepted = answerList(
            pick(it, ["answer", "answers", "correct", "key", "correctAnswer"]),
          );
          if (kind === "true_false_not_given" || kind === "yes_no_not_given")
            accepted = accepted.map((a) => normalizeTfng(a, kind));
          else if (options.length)
            accepted = accepted.map((a) => {
              const byLabel = options.find(
                (o) => o.label.toLowerCase() === a.toLowerCase(),
              );
              const byValue = options.find(
                (o) => o.value.toLowerCase() === a.toLowerCase(),
              );
              return (byValue ?? byLabel)?.value ?? a;
            });
          if (kind === "multiple_choice")
            accepted = accepted.length
              ? [
                  accepted
                    .flatMap((a) => a.split(/[,/]|\s+and\s+/i))
                    .map((a) => a.trim())
                    .filter(Boolean)
                    .sort()
                    .join(","),
                ]
              : [];
          accepted = [
            ...new Set(accepted.map((a) => a.slice(0, 200)).filter(Boolean)),
          ];
          const label = one(
            pick(it, [
              "label",
              "question",
              "text",
              "prompt",
              "q",
              "statement",
            ]) ?? "",
          );
          return {
            id,
            prompt: (
              label ||
              (/match|heading/i.test(type) ? "Match: " + id : "Question " + id)
            ).slice(0, 2000),
            accepted,
            options: options.map((o) => ({
              label: o.label.slice(0, 1000) || o.value,
              value: o.value.slice(0, 200),
            })),
            explanation: findExplanation(expl, key, id),
          };
        },
      );
      return { kind, maxWords: kind === "text" ? maxWords : null, items };
    });
    const title = one(pick(passage, ["title", "name", "heading"]) ?? "");
    return {
      title: (
        title || (skill === "listening" ? "Section " : "Reading Passage ") + key
      ).slice(0, 200),
      body: htmlToText(rawBody).slice(0, 50000),
      groups,
    };
  });
  const questions = parts.reduce(
    (n, p) => n + p.groups.reduce((m, g) => m + g.items.length, 0),
    0,
  );
  if (!questions) throw new ApiError(400, "invalid_input", "reason_html_empty");
  if (questions > 400)
    throw new ApiError(400, "invalid_input", "reason_too_many");
  if (images) warnings.push("warn_images:" + images);
  if (skill === "listening") warnings.push("warn_audio");
  const missing = parts.reduce(
    (n, p) =>
      n +
      p.groups.reduce(
        (m, g) => m + g.items.filter((i) => !i.accepted.length).length,
        0,
      ),
    0,
  );
  if (missing) warnings.push("warn_no_answer:" + missing);
  const pageTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(source)?.[1];
  return {
    title: pageTitle ? one(pageTitle).slice(0, 200) : "",
    skill,
    parts,
    warnings,
  };
}

// ---------- import ----------
export type ImportInput = {
  html: string;
  title: string;
  skill?: "reading" | "listening";
  variant: "academic" | "general";
  access_tier: "free" | "premium";
  dry_run: boolean;
};
export async function importHtmlTest(uid: string, p: ImportInput) {
  const parsed = parseHtmlTest(p.html, p.skill);
  const count = (f: (g: ParsedGroup) => number) =>
    parsed.parts.reduce(
      (n, part) => n + part.groups.reduce((m, g) => m + f(g), 0),
      0,
    );
  const summary = {
    skill: parsed.skill,
    detected_title: parsed.title,
    parts: parsed.parts.length,
    questions: count((g) => g.items.length),
    options: count((g) => g.items.reduce((n, i) => n + i.options.length, 0)),
    answers: count((g) => g.items.filter((i) => i.accepted.length).length),
    warnings: parsed.warnings,
    test_id: null as string | null,
  };
  if (p.dry_run) return summary;
  summary.test_id = await prisma.$transaction(
    async (tx) => {
      const s = new Store(tx, uid);
      const test: Row = await s.mutate("tests", "insert", {
        title: p.title,
        description: "",
        skill: parsed.skill,
        variant: p.variant,
        duration_seconds:
          parsed.durationSeconds ??
          (parsed.skill === "listening" ? 2400 : 3600),
        status: "draft",
        access_tier: p.access_tier,
      });
      let order = 0;
      for (const part of parsed.parts) {
        const section: Row = await s.mutate("test_sections", "insert", {
          test_id: test.id,
          title: part.title,
          position: order++,
        });
        if (part.body)
          await s.mutate("passages", "insert", {
            section_id: section.id,
            title: part.title,
            body: part.body,
          });
        let position = 0;
        for (const group of part.groups)
          for (const item of group.items) {
            const q: Row = await s.mutate("questions", "insert", {
              section_id: section.id,
              prompt: item.prompt,
              kind: group.kind,
              position: position++,
              points: 1,
              ...(group.maxWords ? { max_words: group.maxWords } : {}),
            });
            for (const o of item.options)
              await s.mutate("question_options", "insert", {
                question_id: q.id,
                label: o.label,
                value: o.value,
              });
            if (item.accepted.length)
              await s.mutate("answer_keys", "insert", {
                question_id: q.id,
                accepted: item.accepted,
                explanation: item.explanation,
              });
          }
      }
      return String(test.id);
    },
    { timeout: 120000 },
  );
  return summary;
}
