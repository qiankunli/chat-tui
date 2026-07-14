import type { Theme } from "../types/index.ts";

/** outcome → icon。未知 status 落"进行中"待遇，与 in_progress 同形。 */
const OUTCOME_ICON: Record<string, string> = {
  failed: "✗",
  declined: "⊘",
  completed: "✓",
  pending: "○",
  in_progress: "•",
};

/** 无固有色的 outcome（pending / in_progress / 未知）跟 kind 走：思考是氛围信息故弱化，计划有自己的色。 */
function kindColor(kind: string, theme: Theme): string {
  const byKind: Record<string, string> = { thought: theme.dim, plan: theme.plan };
  return byKind[kind] ?? theme.tool;
}

/** outcome → color：有结局的三态各有其色；其余（进行中/未知）无固有色，交给 kind 决定。 */
function outcomeColor(status: string, kind: string, theme: Theme): string {
  const byOutcome: Record<string, string> = {
    failed: theme.error,
    declined: theme.warning,
    completed: theme.success,
  };
  return byOutcome[status] ?? kindColor(kind, theme);
}

/**
 * activity block 的两根正交展示轴合成一次显示待遇（icon + color）：
 * - **outcome**（`status`）：块的结果/生命周期，恒决定 **icon**（✓ 完成 / ✗ 失败 / ⊘ 拒批 / ○ 待定 / • 进行中）。
 * - **tone**（`tone`）：正交的"注意/留痕"轴，只覆盖 **color**——`warning` 用警示色。
 *
 * 关键：tone 只改颜色、不改 icon。所以 completed+warning = ✓（结果仍是完成，不被遮成 ⚠）+ 警示色，
 * 而不是把结果丢成一个 warning——outcome 与 tone 各说各的，互不吞没。status/tone 取开放 string
 * 容忍未知值（未知 outcome 回落进行中待遇；未知 tone 不覆盖）。
 *
 * 两根轴都用**查表 + 兜底**而非条件链：新增一个 outcome 只是加一行，也免得嵌套三元把"谁决定 icon、
 * 谁决定 color"这条合成规则糊成一坨。
 */
export function blockStatus(
  status: string,
  tone: string | undefined,
  kind: string,
  theme: Theme,
): { icon: string; color: string } {
  return {
    icon: OUTCOME_ICON[status] ?? OUTCOME_ICON.in_progress!,
    color: tone === "warning" ? theme.warning : outcomeColor(status, kind, theme),
  };
}
