import { describe, expect, it, vi } from "vitest";
import { defaultBand } from "@/lib/grading";
vi.mock("server-only", () => ({}));
import {
  extractLiterals,
  htmlToText,
  parseHtmlTest,
} from "@/server/html-import";

describe("defaultBand", () => {
  it("converts raw scores with the official Listening and Reading tables", () => {
    expect(defaultBand("listening", "academic", 30, 40)).toBe(7);
    expect(defaultBand("reading", "academic", 30, 40)).toBe(7);
    expect(defaultBand("reading", "academic", 23, 40)).toBe(6);
    expect(defaultBand("reading", "general", 34, 40)).toBe(7);
    expect(defaultBand("reading", "academic", 40, 40)).toBe(9);
    expect(defaultBand("reading", "academic", 0, 40)).toBe(0);
  });
  it("scales shorter tests to 40 questions and ignores other skills", () => {
    expect(defaultBand("reading", "academic", 15, 20)).toBe(7);
    expect(defaultBand("reading", "academic", 1, 0)).toBeNull();
    expect(defaultBand("writing", "academic", 5, 10)).toBeNull();
  });
});

describe("HTML test import parsing", () => {
  it("reads JavaScript literals without executing anything", () => {
    const { values, errors } = extractLiterals(`
      const A = { 1: 'it\\'s', b: "x" + "y", c: [1, -2.5, true, null,], /* c */ };
      var B = [ {id: 'i', text: \`line\\nbreak\`} ];
      window.C = { z: 0x10 };
      const BAD = { run: (() => 1)() };
      const FINE = {};
    `);
    expect(values.A).toEqual({ 1: "it's", b: "xy", c: [1, -2.5, true, null] });
    expect(values.B).toEqual([{ id: "i", text: "line\nbreak" }]);
    expect(values.C).toEqual({ z: 16 });
    expect(values.FINE).toEqual({});
    expect(errors.BAD).toMatch(/plain data/);
  });
  it("keeps paragraphs and decodes entities", () => {
    expect(
      htmlToText(
        "<style>p{}</style><p><b>A</b> Tea &amp; coffee&nbsp;&mdash; hot</p><div>B<br>second</div><!-- x -->",
      ),
    ).toBe("A Tea & coffee — hot\nB\nsecond");
  });
  it("detects listening, maps answers to option values and warns about gaps", () => {
    const html = `<audio src="a.mp3"></audio><script>
      const LISTENING_SECTIONS = { 1: [
        { type: 'multi-select', items: [{ id: 1, label: 'Pick two', options: ['Red','Green','Blue'], answer: ['Blue','Red'] }] },
        { type: 'fill', items: [{ id: 2, label: 'Name', answer: 'Smith' }, { id: 3, label: 'No key' }] },
      ] };
    </script>`;
    const parsed = parseHtmlTest(html);
    expect(parsed.skill).toBe("listening");
    const [multi, fill] = parsed.parts[0].groups;
    expect(multi.kind).toBe("multiple_choice");
    expect(multi.items[0].accepted).toEqual(["A,C"]);
    expect(fill.items[0].accepted).toEqual(["Smith"]);
    expect(parsed.warnings).toContain("warn_audio");
    expect(parsed.warnings).toContain("warn_no_answer:1");
  });
  it("normalizes true/false/not given answers", () => {
    const parsed = parseHtmlTest(
      `<script>const SECTIONS = {1:[{type:'tfng',items:[{id:1,label:'a',answer:'NG'},{id:2,label:'b',answer:'f'}]},{type:'ynng',items:[{id:3,label:'c',answer:'T'}]}]};</script>`,
    );
    const [tf, yn] = parsed.parts[0].groups;
    expect(tf.items.map((i) => i.accepted[0])).toEqual(["NOT GIVEN", "FALSE"]);
    expect(yn.items[0].accepted).toEqual(["YES"]);
  });
});

describe("interactive exam pages (HTML questions + KEY object)", () => {
  const select = (id: number, ...opts: string[]) =>
    `<select id="q${id}"><option value="">Select</option>${opts.map((o) => `<option>${o}</option>`).join("")}</select>`;
  const html = `<html><head><title>Sample Reading</title></head><body>
  <span id="timeLeft">45:00</span>
  <div class="passage-block active" data-p="1"><h2>Reading Passage 1: Bees</h2>
    <p><strong>A</strong> Bees &amp; flowers.</p><p><strong>B</strong> Honey.</p></div>
  <div class="passage-block" data-p="2"><h2>Reading Passage 2: Tides</h2><p><strong>A</strong> The moon.</p></div>
  <div class="questions-block active" data-p="1">
    <div class="qgroup-title">Questions 1–2 — Choose TRUE, FALSE or NOT GIVEN.</div>
    <div class="question"><p><span class="qnum">1</span>Bees like honey.</p>${select(1, "TRUE", "FALSE", "NOT GIVEN")}</div>
    <div class="question"><p><span class="qnum">2</span>Bees fly at night.</p>${select(2, "TRUE", "FALSE", "NOT GIVEN")}</div>
    <div class="qgroup-title">Questions 3–4 — Complete the notes. Write ONE WORD ONLY.</div>
    <div class="question"><p>A hive has a <span class="qnum">3</span><input type="text" id="q3"> and a <span class="qnum">4</span><input type="text" id="q4"> inside.</p></div>
  </div>
  <div class="questions-block" data-p="2">
    <div class="qgroup-title">Questions 5–6 — Choose TWO letters, A–C. Which TWO are true?</div>
    <p>A Tides are daily. &nbsp; B Tides are random. &nbsp; C The moon matters.</p>
    <div class="question"><p><span class="qnum">5</span>First letter (alphabetically)</p>${select(5, "A", "B", "C")}</div>
    <div class="question"><p><span class="qnum">6</span>Second letter (alphabetically)</p>${select(6, "A", "B", "C")}</div>
    <div class="qgroup-title">Questions 7–8 — Choose the correct letter, A or B.</div>
    <div class="question"><p><span class="qnum">7</span>What pulls the sea?<br>A The sun.<br>B The moon.</p>${select(7, "A", "B")}</div>
    <div class="qgroup-title">Questions 8–9 — Complete the summary using the list, A–C.</div>
    <p>A ocean &nbsp; B planet &nbsp; C moon</p>
    <div class="question"><p>The <span class="qnum">8</span><input type="text" id="q8"> pulls the <span class="qnum">9</span><input type="text" id="q9">.</p></div>
  </div>
  <script>
    const KEY = { q1:"TRUE", q2:"NOT GIVEN", q3:"queen", q4:"honey", q5:"A", q6:"C", q7:"B", q8:"C", q9:"A" };
    const ALT_ANSWERS = { q3: ["Queen Bee"] };
  </script></body></html>`;
  it("reads passages, kinds, options, keys, alternatives and the timer", () => {
    const t = parseHtmlTest(html);
    expect(t).toMatchObject({
      title: "Sample Reading",
      skill: "reading",
      durationSeconds: 2700,
    });
    expect(t.parts.map((p) => p.title)).toEqual([
      "Reading Passage 1: Bees",
      "Reading Passage 2: Tides",
    ]);
    expect(t.parts[0].body).toBe("A Bees & flowers.\nB Honey.");
    const q = Object.fromEntries(
      t.parts.flatMap((p) =>
        p.groups.map((g) => [
          g.items[0].id,
          { kind: g.kind, max: g.maxWords, ...g.items[0] },
        ]),
      ),
    );
    expect(q[1]).toMatchObject({
      kind: "true_false_not_given",
      accepted: ["TRUE"],
      options: [],
    });
    expect(q[2].accepted).toEqual(["NOT GIVEN"]);
    expect(q[3]).toMatchObject({
      kind: "text",
      max: 1,
      accepted: ["queen", "Queen Bee"],
    });
    expect(q[3].prompt).toBe(
      "Q3: A hive has a (3) ____ and a (4) ____ inside.",
    );
    // the empty "Select" placeholder is not an option; the list text becomes the option labels
    expect(q[5].options).toEqual([
      { value: "A", label: "A. Tides are daily." },
      { value: "B", label: "B. Tides are random." },
      { value: "C", label: "C. The moon matters." },
    ]);
    expect(q[5].prompt).toMatch(
      /^Choose TWO letters, A–C\. Which TWO are true\? — First letter/,
    );
    expect(q[7]).toMatchObject({
      kind: "choice",
      prompt: "What pulls the sea?",
      accepted: ["B"],
    });
    expect(q[7].options.map((o: { label: string }) => o.label)).toEqual([
      "A. The sun.",
      "B. The moon.",
    ]);
    // typed letters from a word list become a matching question
    expect(q[8]).toMatchObject({ kind: "matching", accepted: ["C"] });
    expect(q[8].options).toHaveLength(3);
  });
  it("is not confused by pages that only use the literal format", () => {
    const t = parseHtmlTest(
      `<script>const SECTIONS = {1:[{type:'tfng',items:[{id:1,label:'a',answer:'T'}]}]};</script>`,
    );
    expect(t.parts[0].groups[0].kind).toBe("true_false_not_given");
  });
});
