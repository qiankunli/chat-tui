// 三种底部锚定浮层：补全候选 / 命令 picker / 审批卡片。
// 都紧贴输入框上方（对齐 claude code 习惯：视线不用离开输入区），
// anchorBottom 由消费方从 composerHeightFor(draft) + 状态行高度算出。

import type { ReactNode } from "react";

import { defaultTheme, type ApprovalView, type PickerView, type Theme } from "../types/index.ts";
import type { Candidate } from "../utils/completion.ts";

interface SelectOption {
  name: string;
  description: string;
  value?: unknown;
}

export interface SuggestionsProps {
  candidates: Candidate[];
  selectedIndex: number;
  /** 距屏幕底部的行数（输入框高度 + 底部状态行） */
  anchorBottom: number;
  theme?: Theme;
}

/** 补全候选浮层。↑↓/Tab/Esc 的按键处理归消费方（选中态从 selectedIndex 传入）。 */
export function Suggestions(props: SuggestionsProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  if (props.candidates.length === 0) return null;
  return (
    <box
      border
      borderColor={theme.border}
      title="Suggestions (Tab complete · ↑↓ select · Esc close)"
      style={{
        position: "absolute",
        left: 2,
        bottom: props.anchorBottom,
        width: 60,
        height: props.candidates.length + 2,
        zIndex: 150,
        flexDirection: "column",
      }}
    >
      {props.candidates.map((candidate, index) => (
        <text key={candidate.insert} fg={index === props.selectedIndex ? theme.accent : undefined}>
          {`${index === props.selectedIndex ? "▸ " : "  "}${candidate.label}  ${candidate.detail}`}
        </text>
      ))}
    </box>
  );
}

export interface PickerProps {
  picker: PickerView;
  anchorBottom: number;
  theme?: Theme;
  onSelect: (value: string) => void;
}

/** 命令 picker（选 provider / model / session 等）。Esc 关闭由消费方的键盘层处理。 */
export function Picker(props: PickerProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  return (
    <box
      title={props.picker.title}
      border
      borderColor={theme.accent}
      style={{
        position: "absolute",
        left: 2,
        bottom: props.anchorBottom,
        width: 72,
        height: Math.min(18, props.picker.options.length * 2 + 2),
        zIndex: 190,
        flexDirection: "column",
      }}
    >
      <select
        focused
        style={{ flexGrow: 1 }}
        options={props.picker.options}
        onSelect={(_i: number, opt: SelectOption | null) => {
          if (opt) props.onSelect(String(opt.value));
        }}
      />
    </box>
  );
}

export interface ApprovalCardProps {
  approval: ApprovalView;
  anchorBottom: number;
  theme?: Theme;
  onSelect: (optionId: string) => void;
}

/** 审批卡片。比 Picker 的 zIndex 更高——审批永远压过其它浮层。 */
export function ApprovalCard(props: ApprovalCardProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  return (
    <box
      title="Approval required"
      border
      borderColor={theme.borderActive}
      style={{
        position: "absolute",
        left: 2,
        bottom: props.anchorBottom,
        width: 72,
        height: 10,
        zIndex: 200,
        flexDirection: "column",
      }}
    >
      <text>{props.approval.title}</text>
      <select
        focused
        style={{ flexGrow: 1 }}
        options={props.approval.options.map((o) => ({ name: o.name, description: o.kind, value: o.optionId }))}
        onSelect={(_i: number, opt: SelectOption | null) => {
          if (opt) props.onSelect(String(opt.value));
        }}
      />
    </box>
  );
}
