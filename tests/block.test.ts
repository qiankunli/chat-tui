import { describe, expect, test } from "bun:test";

import { blockStatus } from "../src/components/block.ts";
import { defaultTheme as t } from "../src/types/index.ts";

describe("blockStatus dual axis (outcome × tone)", () => {
  test("icon comes from outcome (status)", () => {
    expect(blockStatus("failed", undefined, "tool", t).icon).toBe("✗");
    expect(blockStatus("declined", undefined, "tool", t).icon).toBe("⊘");
    expect(blockStatus("completed", undefined, "tool", t).icon).toBe("✓");
    expect(blockStatus("pending", undefined, "tool", t).icon).toBe("○");
    expect(blockStatus("in_progress", undefined, "tool", t).icon).toBe("•");
  });

  test("outcome color: failed→error, declined→warning, completed→success", () => {
    expect(blockStatus("failed", undefined, "tool", t).color).toBe(t.error);
    expect(blockStatus("declined", undefined, "tool", t).color).toBe(t.warning);
    expect(blockStatus("completed", undefined, "tool", t).color).toBe(t.success);
  });

  test("warning tone overrides color but keeps the outcome icon (not masked to ⚠)", () => {
    const done = blockStatus("completed", "warning", "tool", t);
    expect(done.icon).toBe("✓"); // 结果仍是完成，不被遮成 ⚠
    expect(done.color).toBe(t.warning); // tone 只改颜色
    // pending + warning：icon 仍是 outcome 的 ○，颜色被 tone 覆盖
    expect(blockStatus("pending", "warning", "tool", t)).toEqual({ icon: "○", color: t.warning });
  });

  test("pending/in_progress color follows kind; unknown status falls back to in_progress treatment", () => {
    expect(blockStatus("pending", undefined, "thought", t).color).toBe(t.dim);
    expect(blockStatus("pending", undefined, "plan", t).color).toBe(t.plan);
    expect(blockStatus("in_progress", undefined, "tool", t).color).toBe(t.tool);
    expect(blockStatus("some_future_status", undefined, "tool", t).icon).toBe("•");
  });
});
