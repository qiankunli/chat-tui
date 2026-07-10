// chat-tui 的对外契约：视图模型进、intents（回调）出。
// 刻意不定义 session / turn / provider / 事件流语义——那些归消费方的 harness 层；
// 消费方把自家状态 reduce/映射成这里的视图形状（这层映射越薄，说明 harness 的事件模型越健康）。

export type Tone = "info" | "error";

export interface StatusMessage {
  text: string;
  tone: Tone;
}

export type ToolCallStatus = "pending" | "in_progress" | "completed" | "failed";
export type PlanEntryStatus = "pending" | "in_progress" | "completed";

/**
 * 时间线条目。消费方负责把消息/工具调用/计划整理成展示形状：
 * - tool_call 的 detailLines / tailLines 已是"整理好的行"，chat-tui 不理解 diff 等块语义，
 *   这让不同 harness 的工具输出结构差异停在消费方一侧。
 */
export type TranscriptItem =
  | {
      type: "message";
      id: string;
      role: "user" | "agent" | "thought";
      /** 展示名（如 "you" / "codex" / "claude"）；缺省时按 role 取默认 */
      author?: string;
      text: string;
    }
  | {
      type: "tool_call";
      id: string;
      title?: string;
      status: ToolCallStatus;
      /** 标题下的补充行（如 diff 的 "± modify path"），已由消费方格式化 */
      detailLines?: string[];
      /** 运行中的输出尾巴；仅 in_progress 时展示 */
      tailLines?: string[];
    }
  | {
      type: "plan";
      id: string;
      entries: Array<{ content: string; status: PlanEntryStatus }>;
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
  error: "#f7768e",
  accent: "#7aa2f7",
  border: "#3b4261",
  borderActive: "#e0af68",
};
