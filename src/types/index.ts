// chat-tui 的对外契约：视图模型进、intents（回调）出。
// 刻意不定义 session / turn / provider / 事件流语义——那些归消费方的 harness 层；
// 消费方把自家状态 reduce/映射成这里的视图形状（这层映射越薄，说明 harness 的事件模型越健康）。

export type Tone = "info" | "error";

export interface StatusMessage {
  text: string;
  tone: Tone;
}

export type TranscriptBlockStatus = "pending" | "in_progress" | "completed" | "failed";
export type PlanEntryStatus = "pending" | "in_progress" | "completed";

export type TranscriptBlockContent =
  | { type: "text"; text: string }
  | { type: "lines"; lines: string[] }
  | { type: "plan"; entries: Array<{ content: string; status: PlanEntryStatus }> };

/**
 * 时间线展示形状。消费方把 agent 事件归一成普通消息或 activity block；
 * block content 已完成展示侧格式化，chat-tui 不理解 diff 等 provider 内容语义。
 */
export type TranscriptItem =
  | {
      type: "message";
      id: string;
      role: "user" | "agent";
      /** 展示名（如 "you" / "codex" / "claude"）；缺省时按 role 取默认 */
      author?: string;
      text: string;
    }
  | {
      type: "block";
      id: string;
      /** 展示类型，如 thought / tool / plan；开放字符串便于接入方扩展。 */
      kind: string;
      status: TranscriptBlockStatus;
      title: string;
      content?: TranscriptBlockContent;
    };

export interface ApprovalOption {
  optionId: string;
  name: string;
  kind: string;
}

export interface ApprovalView {
  title: string;
  options: ApprovalOption[];
}

export interface PickerOption {
  name: string;
  description: string;
  value: string;
}

export interface PickerView {
  title: string;
  options: PickerOption[];
}

export interface QueuedItem {
  id: string;
  text: string;
  /** 右侧标注（如目标 provider 名） */
  tag?: string;
}

/** slash 命令声明：chat-tui 只用于补全候选，语义执行归消费方 */
export interface CommandSpec {
  name: string;
  description: string;
}

/** 配色主题。默认值取自 tokyo-night，消费方可整体或逐项覆盖。 */
export interface Theme {
  dim: string;
  user: string;
  agent: string;
  tool: string;
  plan: string;
  success: string;
  error: string;
  accent: string;
  border: string;
  borderActive: string;
  /** 按 author 名着色 agent 消息；返回 undefined 时用 theme.agent */
  agentColorFor?: (author: string) => string | undefined;
}

export const defaultTheme: Theme = {
  dim: "#565f89",
  user: "#7aa2f7",
  agent: "#bb9af7",
  tool: "#e0af68",
  plan: "#7dcfff",
  success: "#9ece6a",
  error: "#f7768e",
  accent: "#7aa2f7",
  border: "#3b4261",
  borderActive: "#e0af68",
};
