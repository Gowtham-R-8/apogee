// Keyboard and live-region helpers for modal dialogs (#315).
// Kept free of DOM globals beyond the nodes passed in, so node tests can
// exercise the trap order and the announcer timing without a browser.

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function isRendered(element) {
  // Hidden-attribute check only: layout rects are zero in test DOMs
  // (linkedom) and in real browsers for display:none alike, so rects
  // cannot tell the two apart. CSS-hidden subtrees inside an open dialog
  // are the caller's concern; nothing in the dialog hides that way.
  if (!element || element.hidden) return false;
  return !element.closest?.("[hidden]");
}

// Tab order inside a dialog, in DOM order. The caller owns focus movement.
export function getTrapTargets(root) {
  if (!root || typeof root.querySelectorAll !== "function") return [];
  return [...root.querySelectorAll(FOCUSABLE_SELECTOR)].filter(isRendered);
}

// The element that should receive focus for a Tab/Shift+Tab press when
// `current` is focused. Returns null when the press stays where it is.
export function nextTrapTarget(targets, current, shiftKey) {
  if (!Array.isArray(targets) || targets.length === 0) return null;
  const index = targets.indexOf(current);
  if (index === -1) return shiftKey ? targets[targets.length - 1] : targets[0];
  if (!shiftKey && index === targets.length - 1) return targets[0];
  if (shiftKey && index === 0) return targets[targets.length - 1];
  return null;
}

// Wires a Tab keydown event to the trap. Returns true when handled.
export function handleTrapTabKey(event, root, current) {
  if (!event || event.key !== "Tab") return false;
  const targets = getTrapTargets(root);
  const next = nextTrapTarget(targets, current, event.shiftKey);
  if (!next) {
    // No wrap point (empty dialog, or a mid-list Tab): hold focus inside
    // when there is nowhere to go, otherwise let the browser move it.
    if (targets.length === 0) event.preventDefault();
    return targets.length === 0;
  }
  event.preventDefault();
  next.focus();
  return true;
}

// Trailing-edge announcer: rapid calls collapse to the last message
// (last-wins), delivered after delayMs. An exact repeat of the message
// already on the live region is dropped so screen readers do not chatter.
// `write` performs the DOM update; tests inject a recorder.
export function createAnnouncer(write, { delayMs = 300 } = {}) {
  let timer = null;
  let pending = null;
  let delivered = Symbol("none");

  function deliver() {
    timer = null;
    const message = pending;
    pending = null;
    if (message === delivered) return;
    delivered = message;
    write(message);
  }

  function announce(message) {
    if (timer) clearTimeout(timer);
    else if (message === delivered) return;
    pending = message;
    timer = setTimeout(deliver, delayMs);
  }

  announce.flush = () => {
    if (timer) {
      clearTimeout(timer);
      deliver();
    }
  };
  announce.pending = () => pending;

  return announce;
}
