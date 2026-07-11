import { describe, expect, test } from "bun:test";

import { CTRL_C_CONFIRM_WINDOW_MS, ctrlCAction, escapeAction } from "../src/utils/keys.ts";

describe("escapeAction", () => {
  test("the innermost popup handles Esc before a running turn", () => {
    expect(escapeAction({ busy: true, hasPicker: true, hasCandidates: false })).toBe("close-picker");
    expect(escapeAction({ busy: true, hasPicker: false, hasCandidates: true })).toBe("dismiss-suggestions");
  });

  test("a running turn is interrupted when no local popup is active", () => {
    expect(escapeAction({ busy: true, hasPicker: false, hasCandidates: false })).toBe("cancel-turn");
  });

  test("idle popups keep their local Esc behavior", () => {
    expect(escapeAction({ busy: false, hasPicker: true, hasCandidates: false })).toBe("close-picker");
    expect(escapeAction({ busy: false, hasPicker: false, hasCandidates: true })).toBe("dismiss-suggestions");
    expect(escapeAction({ busy: false, hasPicker: false, hasCandidates: false })).toBe("none");
  });
});

describe("ctrlCAction", () => {
  test("busy wins: cancel the running turn", () => {
    expect(ctrlCAction({ busy: true, hasDraft: true, armedAt: 0, now: 1000 })).toBe("cancel-turn");
  });

  test("draft present: clear it", () => {
    expect(ctrlCAction({ busy: false, hasDraft: true, armedAt: 0, now: 1000 })).toBe("clear-draft");
  });

  test("idle: arm first, exit within confirm window", () => {
    const now = 10_000;
    expect(ctrlCAction({ busy: false, hasDraft: false, armedAt: 0, now })).toBe("arm-exit");
    expect(ctrlCAction({ busy: false, hasDraft: false, armedAt: now, now: now + CTRL_C_CONFIRM_WINDOW_MS - 1 })).toBe("exit");
    expect(ctrlCAction({ busy: false, hasDraft: false, armedAt: now, now: now + CTRL_C_CONFIRM_WINDOW_MS + 1 })).toBe("arm-exit");
  });
});
