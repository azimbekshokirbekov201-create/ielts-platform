import { ApiError } from "./local/engine";
import type { ParsedGroup, ParsedPart, ParsedTest } from "./html-import";

/**
 * Interactive exam pages: the passages and questions are written as HTML (`<select id="q7">`,
 * `<input id="q8">`) and the answers live in a `KEY = { q1: "TRUE", ... }` object.
 * Nothing in the page is executed; it is read through a small tolerant tree builder.
 */
type DomNode = {
  tag: string;
  attrs: Record<string, string>;
  children: (DomNode | string)[];
  parent?: DomNode;
};
const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
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
const VOID = new Set([
  "br",
  "img",
  "input",
  "hr",
  "meta",
  "link",
  "source",
  "wbr",
  "col",
  "area",
  "base",
]);
function parseAttrs(raw: string) {
  const attrs: Record<string, string> = {};
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)))
    attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  return attrs;
}
export function parseDom(html: string): DomNode {
  const root: DomNode = { tag: "#root", attrs: {}, children: [] };
  const lower = html.toLowerCase();
  let cur = root;
  const re =
    /<!--[\s\S]*?-->|<![A-Za-z][^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>]+))?)*)\s*(\/?)>|[^<]+|</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [all, close, open, rawAttrs, selfClose] = m;
    if (all.startsWith("<!")) continue;
    if (close) {
      const tag = close.toLowerCase();
      let n: DomNode | undefined = cur;
      while (n && n.tag !== tag) n = n.parent;
      if (n?.parent) cur = n.parent;
      continue;
    }
    if (open) {
      const tag = open.toLowerCase();
      if (["option", "p", "li"].includes(tag) && cur.tag === tag && cur.parent)
        cur = cur.parent;
      const node: DomNode = {
        tag,
        attrs: parseAttrs(rawAttrs || ""),
        children: [],
        parent: cur,
      };
      cur.children.push(node);
      if (tag === "script" || tag === "style") {
        const end = lower.indexOf("</" + tag, re.lastIndex);
        re.lastIndex =
          end < 0 ? html.length : html.indexOf(">", end) + 1 || html.length;
      } else if (!VOID.has(tag) && !selfClose) cur = node;
      continue;
    }
    cur.children.push(all);
  }
  return root;
}
function* walk(n: DomNode): Generator<DomNode> {
  for (const c of n.children)
    if (typeof c !== "string") {
      yield c;
      yield* walk(c);
    }
}
const elements = (n: DomNode) =>
  n.children.filter((c): c is DomNode => typeof c !== "string");
const hasClass = (n: DomNode, re: RegExp) => re.test(n.attrs.class ?? "");
const BLOCK = new Set([
  "p",
  "div",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "tr",
  "table",
  "ul",
  "ol",
  "section",
  "article",
  "blockquote",
]);
type Hook = (n: DomNode) => string | undefined;
function render(n: DomNode | string, hook?: Hook): string {
  if (typeof n === "string") return decode(n);
  const custom = hook?.(n);
  if (custom !== undefined) return custom;
  if (n.tag === "br") return "\n";
  if (["script", "style", "select", "button"].includes(n.tag)) return "";
  const inner = n.children.map((c) => render(c, hook)).join("");
  return BLOCK.has(n.tag) ? "\n" + inner + "\n" : inner;
}
const textOf = (n: DomNode, hook?: Hook) =>
  render(n, hook)
    .split("\n")
    .map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
const numberOf = (n: DomNode) => Number(/\d+/.exec(n.attrs.id ?? "")?.[0]);
const isControl = (n: DomNode) =>
  ["select", "input", "textarea"].includes(n.tag) &&
  /^q\d+$/i.test(n.attrs.id ?? "");
const wordsByName: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
};

/** "A text &nbsp; B text &nbsp; C text" on one line -> [{A, text}, ...]. */
function splitLetterList(p: DomNode) {
  const raw = p.children.map((c) => (typeof c === "string" ? c : " ")).join("");
  const out = raw
    .split(/(?:&nbsp;|\u00a0)+/)
    .map((x) => decode(x).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((x) => /^([A-Z])[.)]?\s+(.+)$/.exec(x));
  return out.length >= 2 && out.every(Boolean) && out[0]![1] === "A"
    ? out.map((m) => ({ value: m![1], text: m![2] }))
    : null;
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

export function parseInteractive(
  source: string,
  values: Record<string, unknown>,
  hint?: "reading" | "listening",
): ParsedTest | null {
  const isQKeys = (v: unknown): v is Record<string, unknown> =>
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length > 0 &&
    Object.keys(v).every((k) => /^q\d+$/i.test(k));
  const keyed = Object.values(values).filter(isQKeys);
  const key = keyed
    .filter((v) =>
      Object.values(v).every(
        (x) => typeof x === "string" || typeof x === "number",
      ),
    )
    .sort((a, b) => Object.keys(b).length - Object.keys(a).length)[0] as
    Record<string, string | number> | undefined;
  const alt = keyed.find((v) => Object.values(v).every(Array.isArray)) as
    Record<string, unknown[]> | undefined;
  if (!key) return null;
  const dom = parseDom(source);
  const all = [...walk(dom)];
  if (!all.some(isControl)) return null;

  const blocks = all.filter(
    (n) => n.attrs["data-p"] !== undefined && hasClass(n, /question/i),
  );
  const passageNodes = all.filter(
    (n) =>
      n.attrs["data-p"] !== undefined &&
      hasClass(n, /passage/i) &&
      !hasClass(n, /question/i),
  );
  const partKeys = [
    ...new Set([...passageNodes, ...blocks].map((n) => n.attrs["data-p"])),
  ].sort((a, b) => Number(a) - Number(b));
  if (!partKeys.length) partKeys.push("1");
  // number markers inside a sentence become "(7) ____"; the leading question number is dropped
  const hook: Hook = (n) =>
    n.tag === "span" && hasClass(n, /qnum/)
      ? ""
      : n.tag === "input" || n.tag === "textarea"
        ? "(" + numberOf(n) + ") ____"
        : undefined;
  let images = 0;
  const parts: ParsedPart[] = partKeys.map((pk) => {
    const passage = passageNodes.find((n) => n.attrs["data-p"] === pk);
    const heading =
      passage &&
      [...walk(passage)].find((n) => ["h1", "h2", "h3"].includes(n.tag));
    const title = (heading ? textOf(heading) : "") || "Reading Passage " + pk;
    const body = passage
      ? textOf(passage, (n) =>
          ["h1", "h2", "h3"].includes(n.tag) ? "" : undefined,
        )
      : "";
    if (passage)
      images += [...walk(passage)].filter((n) => n.tag === "img").length;
    const holders = blocks.filter((n) => n.attrs["data-p"] === pk);
    if (!holders.length && partKeys.length === 1) holders.push(dom);
    type Group = {
      title: string;
      list: { value: string; text: string }[];
      questions: DomNode[];
    };
    const groups: Group[] = [];
    for (const holder of holders)
      for (const child of elements(holder)) {
        if (hasClass(child, /qgroup|group-title/i))
          groups.push({ title: textOf(child), list: [], questions: [] });
        else if (hasClass(child, /(^|\s)question(\s|$)/i)) {
          if (!groups.length)
            groups.push({ title: "", list: [], questions: [] });
          groups[groups.length - 1].questions.push(child);
        } else if (child.tag === "p" && groups.length) {
          const list = splitLetterList(child);
          if (list) groups[groups.length - 1].list = list;
        }
      }
    const out: ParsedGroup[] = [];
    for (const g of groups) {
      const instruction = g.title.replace(
        /^Questions?\s+\d+\s*(?:[–—-]\s*\d+)?\s*[—–:-]\s*/i,
        "",
      );
      const wordName = /\b(ONE|TWO|THREE|FOUR)\s+WORDS?\b/i
        .exec(instruction)?.[1]
        ?.toUpperCase();
      const maxWords = wordName ? wordsByName[wordName] : null;
      const listLabel = new Map(
        g.list.map((o) => [o.value, o.value + ". " + o.text]),
      );
      for (const q of g.questions) {
        const controls = [...walk(q)].filter(isControl);
        for (const c of controls) {
          const n = numberOf(c);
          const answerRaw = key["q" + n];
          const extra = (alt?.["q" + n] ?? []).map(String);
          let paragraph: DomNode = q;
          for (let x = c.parent; x && x !== q; x = x.parent)
            if (x.tag === "p") {
              paragraph = x;
              break;
            }
          const selectValues =
            c.tag === "select"
              ? elements(c)
                  // the empty "Select" placeholder is not an answer
                  .filter((o) => o.tag === "option" && o.attrs.value !== "")
                  .map((o) => textOf(o))
                  .filter((v) => v && !/^(select|choose|—|-+)$/i.test(v))
              : [];
          const upper = [...new Set(selectValues.map((v) => v.toUpperCase()))];
          const subset = (...ok: string[]) =>
            upper.length > 0 && upper.every((v) => ok.includes(v));
          const lines = textOf(paragraph, hook).split("\n");
          const at = lines.findIndex(
            (l, i) =>
              /^A[.)]?\s/.test(l) && /^B[.)]?\s/.test(lines[i + 1] ?? ""),
          );
          let kind = "text";
          let options: { label: string; value: string }[] = [];
          let prompt = "";
          if (c.tag === "select") {
            if (subset("TRUE", "FALSE", "NOT GIVEN"))
              kind = "true_false_not_given";
            else if (subset("YES", "NO", "NOT GIVEN"))
              kind = "yes_no_not_given";
            else if (at > 0) {
              kind = "choice";
              options = lines
                .slice(at)
                .map((l) => /^([A-Z])[.)]?\s+(.*)$/.exec(l))
                .filter((m): m is RegExpExecArray => !!m)
                .map((m) => ({ value: m[1], label: m[1] + ". " + m[2] }));
              prompt = lines.slice(0, at).join(" ");
            } else if (g.list.length) {
              kind = "choice";
              options = selectValues.map((l) => ({
                value: l,
                label: listLabel.get(l) ?? l,
              }));
            } else {
              kind = /paragraph|match/i.test(instruction)
                ? "matching"
                : "choice";
              options = selectValues.map((l) => ({ value: l, label: l }));
            }
          } else if (
            typeof answerRaw === "string" &&
            /^[A-Z]$/.test(answerRaw.trim()) &&
            g.list.length
          ) {
            kind = "matching";
            options = g.list.map((o) => ({
              value: o.value,
              label: o.value + ". " + o.text,
            }));
          }
          if (!prompt) {
            const blanks = [...walk(paragraph)].filter(isControl).length;
            prompt = (blanks > 1 ? "Q" + n + ": " : "") + lines.join(" ");
          }
          // "First letter (alphabetically)" means nothing alone: put the instruction in front
          if (
            instruction &&
            /^(first|second|third|fourth)\b.*\b(letter|answer)/i.test(prompt)
          )
            prompt = instruction.slice(0, 400) + " — " + prompt;
          let accepted =
            answerRaw === undefined ? [] : [String(answerRaw), ...extra];
          if (kind === "true_false_not_given" || kind === "yes_no_not_given")
            accepted = accepted.map((a) => normalizeTfng(a, kind));
          else if (kind === "choice" || kind === "matching")
            accepted = accepted.map((a) => a.trim().toUpperCase());
          accepted = [
            ...new Set(
              accepted.map((a) => a.trim().slice(0, 200)).filter(Boolean),
            ),
          ];
          out.push({
            kind,
            maxWords: kind === "text" ? maxWords : null,
            items: [
              {
                id: String(n),
                prompt: (prompt || "Question " + n).slice(0, 2000),
                accepted,
                options: options.map((o) => ({
                  label: o.label.slice(0, 1000),
                  value: o.value.slice(0, 200),
                })),
                explanation: "",
              },
            ],
          });
        }
      }
    }
    out.sort((a, b) => Number(a.items[0].id) - Number(b.items[0].id));
    return {
      title: title.slice(0, 200),
      body: body.slice(0, 50000),
      groups: out,
    };
  });
  const questions = parts.reduce((n, p) => n + p.groups.length, 0);
  if (!questions) throw new ApiError(400, "invalid_input", "reason_html_empty");
  if (questions > 400)
    throw new ApiError(400, "invalid_input", "reason_too_many");
  const warnings: string[] = [];
  if (images) warnings.push("warn_images:" + images);
  const missing = parts.reduce(
    (n, p) => n + p.groups.filter((g) => !g.items[0].accepted.length).length,
    0,
  );
  if (missing) warnings.push("warn_no_answer:" + missing);
  const skill = hint ?? (/<audio\b/i.test(source) ? "listening" : "reading");
  if (skill === "listening") warnings.push("warn_audio");
  const timer = all.find((n) => n.attrs.id === "timeLeft");
  const minutes = timer ? Number(/(\d+)\s*:/.exec(textOf(timer))?.[1]) : NaN;
  const pageTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(source)?.[1];
  return {
    title: pageTitle
      ? decode(pageTitle).replace(/\s+/g, " ").trim().slice(0, 200)
      : "",
    skill,
    parts,
    warnings,
    ...(minutes > 0 && minutes <= 240 ? { durationSeconds: minutes * 60 } : {}),
  };
}
