import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import {
  getTrapTargets,
  nextTrapTarget,
  handleTrapTabKey,
  createAnnouncer,
} from "../../lib/util/a11y.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function pasteDialogDocument() {
  const html = readFileSync(
    new URL("../../ui/app.html", import.meta.url),
    "utf8",
  );
  return parseHTML(html).document;
}

function stubKeyEvent(key = "Tab", shiftKey = false) {
  return {
    key,
    shiftKey,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

test("paste dialog carries modal labelling", () => {
  const dialog = pasteDialogDocument().getElementById("pasteDialog");
  assert.strictEqual(dialog.getAttribute("role"), "dialog");
  assert.strictEqual(dialog.getAttribute("aria-modal"), "true");
  const labelledBy = dialog.getAttribute("aria-labelledby");
  assert.ok(labelledBy, "dialog must name its label");
  assert.ok(
    dialog.querySelector(`#${labelledBy}`),
    "aria-labelledby must point at an element inside the dialog",
  );
});

test("trap targets follow the dialog tab order", () => {
  const dialog = pasteDialogDocument().getElementById("pasteDialog");
  const ids = getTrapTargets(dialog).map((el) => el.id || el.type);
  assert.deepStrictEqual(ids, [
    "pasteDialogInput",
    "pasteDialogCancel",
    "submit",
  ]);
});

test("tab wraps from last to first, shift+tab from first to last", () => {
  const [first, mid, last] = [{}, {}, {}];
  const targets = [first, mid, last];
  assert.strictEqual(nextTrapTarget(targets, last, false), first);
  assert.strictEqual(nextTrapTarget(targets, first, true), last);
  assert.strictEqual(nextTrapTarget(targets, mid, false), null);
  assert.strictEqual(nextTrapTarget(targets, mid, true), null);
  assert.strictEqual(nextTrapTarget(targets, {}, false), first);
  assert.strictEqual(nextTrapTarget([], first, false), null);
});

test("trap handler moves focus and swallows the key", () => {
  const focused = [];
  const targets = [
    { focus: () => focused.push("first") },
    { focus: () => focused.push("last") },
  ];
  const root = { querySelectorAll: () => targets };
  const event = stubKeyEvent("Tab", false);
  assert.strictEqual(handleTrapTabKey(event, root, targets[1]), true);
  assert.strictEqual(event.defaultPrevented, true);
  assert.deepStrictEqual(focused, ["first"]);
});

test("trap handler ignores non-tab keys and holds empty dialogs", () => {
  const other = stubKeyEvent("Escape", false);
  assert.strictEqual(handleTrapTabKey(other, null, null), false);
  assert.strictEqual(other.defaultPrevented, false);

  const empty = stubKeyEvent("Tab", false);
  assert.strictEqual(
    handleTrapTabKey(empty, { querySelectorAll: () => [] }, null),
    true,
  );
  assert.strictEqual(empty.defaultPrevented, true);
});

test("rapid announces collapse to the last message", async () => {
  const written = [];
  const announce = createAnnouncer((msg) => written.push(msg), {
    delayMs: 20,
  });
  announce("first");
  announce("second");
  announce("third");
  assert.strictEqual(announce.pending(), "third");
  await sleep(60);
  assert.deepStrictEqual(written, ["third"]);
});

test("exact repeats of the shown message are dropped", async () => {
  const written = [];
  const announce = createAnnouncer((msg) => written.push(msg), {
    delayMs: 20,
  });
  announce("Copied to clipboard.");
  await sleep(60);
  announce("Copied to clipboard.");
  await sleep(60);
  assert.deepStrictEqual(written, ["Copied to clipboard."]);
});

test("flush delivers the final message immediately", () => {
  const written = [];
  const announce = createAnnouncer((msg) => written.push(msg), {
    delayMs: 10_000,
  });
  announce("final");
  announce.flush();
  assert.deepStrictEqual(written, ["final"]);
  assert.strictEqual(announce.pending(), null);
});
