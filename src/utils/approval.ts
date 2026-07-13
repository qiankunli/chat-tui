import { wrapLine } from "./clip.ts";

export interface ApprovalCardLayout {
  width: number;
  height: number;
  detailRows: number;
  actionRows: number;
}

interface ApprovalCardLayoutInput {
  terminalWidth: number;
  terminalHeight: number;
  anchorBottom: number;
  detail: string;
  optionCount: number;
}

/** 审批动作必须先占到可交互空间；详情只能使用剩余高度。 */
export function approvalCardLayout(input: ApprovalCardLayoutInput): ApprovalCardLayout {
  const width = Math.max(20, Math.min(96, input.terminalWidth - 4));
  const availableHeight = Math.max(4, input.terminalHeight - input.anchorBottom - 1);
  const actionRows = Math.min(Math.max(1, input.optionCount), Math.max(1, availableHeight - 3));
  const maxDetailRows = Math.max(1, availableHeight - actionRows - 2);
  const contentWidth = Math.max(1, width - 2);
  const neededDetailRows = input.detail
    .split("\n")
    .flatMap((line) => wrapLine(line, contentWidth)).length;
  const detailRows = Math.min(Math.max(1, neededDetailRows), maxDetailRows);

  return {
    width,
    height: Math.min(availableHeight, detailRows + actionRows + 2),
    detailRows,
    actionRows,
  };
}
