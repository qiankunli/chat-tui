import type { Theme } from "../types/index.ts";

/**
 * activity block 的两根正交展示轴合成一次显示待遇（icon + color）：
 * - **outcome**（`status`）：块的结果/生命周期，恒决定 **icon**（✓ 完成 / ✗ 失败 / ⊘ 拒批 / ○ 待定 / • 进行中）。
 * - **tone**（`tone`）：正交的"注意/留痕"轴，覆盖 **color**——`warning` 用警示色。
 *
 * 关键：tone 只改颜色、不改 icon。所以 completed+warning = ✓（结果仍是完成，不被遮成 ⚠）+ 警示色，
 * 而不是把结果丢成一个 warning——outcome 与 tone 各说各的，互不吞没。status/tone 取开放 string
 * 容忍未知值（未知 outcome 回落 pending/进行中待遇；未知 tone 不覆盖）。
 */
export function blockStatus(
  status: string,
  tone: string | undefined,
  kind: string,
  theme: Theme,
): { icon: string; color: string } {
  const outcome =
    status === "failed"
      ? { icon: "✗", color: theme.error }
      : status === "declined"
        ? { icon: "⊘", color: theme.warning }
        : status === "completed"
          ? { icon: "✓", color: theme.success }
          : {
              icon: status === "pending" ? "○" : "•", // pending / in_progress / 未知
              color: kind === "thought" ? theme.dim : kind === "plan" ? theme.plan : theme.tool,
            };
  return tone === "warning" ? { icon: outcome.icon, color: theme.warning } : outcome;
}
