import { describe, expect, test } from "bun:test";

import { CTRL_C_CONFIRM_WINDOW_MS, ctrlCAction } from "../src/utils/keys.ts";

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
