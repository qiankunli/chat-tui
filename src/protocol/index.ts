// chat-tui 的接入协议：接入方实现 ChatProtocol，ChatShell 负责渲染与交互。
//
//   输出（接入方 → TUI）：getView() 返回完整视图快照 + subscribe() 变更通知。
//     选快照而非增量事件：TUI 规模下全量重渲染足够便宜，接入方不用维护
//     delta 语义，本地 harness 和远端转发（SSE/WebSocket → 本地状态）实现同构。
//   输入（TUI → 接入方）：submit / command / cancel / exit / resolvePicker /
//     resolveApproval / recallQueued。接入方拿到后自行决定发给本地进程还是远端。

import type {
  ApprovalView,
  PickerView,
  QuestionAnswers,
  QuestionView,
  QueuedItem,
  StatusMessage,
  TranscriptItem,
} from "../types/index.ts";

export interface ChatViewState {
  transcript: TranscriptItem[];
  /** 有 turn 在跑：Ctrl+C/Esc 变为"打断"，输入框边框高亮 */
  busy?: boolean;
  /** "xx thinking… (Esc to interrupt)" 一类的运行中提示行 */
  runningNotices?: string[];
  /** 排队中的 steer 输入（队列本体归接入方） */
  queued?: QueuedItem[];
  queuedHint?: string;
  /** 接入方请求 TUI 弹选择浮层；用户选择/关闭通过 resolvePicker 回传 */
  picker?: (PickerView & { id: string }) | null;
  /** 待审批请求（一次一个，排队归接入方）；选择通过 resolveApproval 回传 */
  approval?: (ApprovalView & { id: string }) | null;
  /** agent 主动向用户索取结构化输入；与 permission approval 保持独立。 */
  question?: (QuestionView & { id: string }) | null;
  /** 瞬时状态（错误/提示），优先于 footer 展示 */
  status?: StatusMessage | null;
  /** 常驻底部信息行（usage、队列长度、cwd 等） */
  footer?: string;
  /** 输入框边框标题（如 "provider:codex · model:default"） */
  composerTitle?: string;
  composerPlaceholder?: string;
  /** 时间线顶部说明（产品名、快捷键提示） */
  header?: string;
  /** thought 消息是否渲染 */
  showThoughts?: boolean;
}

export interface ChatProtocol {
  // ===== 输出：接入方 → TUI =====
  /**
   * 返回当前视图快照。ChatShell 用 useSyncExternalStore 消费：
   * 未变化时必须返回同一对象引用（变化时换新对象），否则会触发无限重渲染。
   * 推荐实现：内部持有一个 view 对象，每次变更整体替换后再通知 subscribe 监听者。
   */
  getView(): ChatViewState;
  /** 视图变化时通知；返回取消订阅函数 */
  subscribe(onChange: () => void): () => void;

  // ===== 输入：TUI → 接入方 =====
  /** 普通消息（slash 命令已被 TUI 识别并走 command()，不会进这里） */
  submit(text: string): void | Promise<void>;
  /** 已注册 slash 命令：/name argument */
  command(name: string, argument: string): void | Promise<void>;
  /** 打断当前 turn（Esc / busy 时 Ctrl+C） */
  cancel(): void;
  /** 优雅退出（/exit、双击 Ctrl+C、Ctrl+D）；进程退出由接入方决定 */
  exit(): void | Promise<void>;
  /** picker 选择结果；用户 Esc 关闭时 value 为 null */
  resolvePicker(id: string, value: string | null): void;
  resolveApproval(id: string, optionId: string): void;
  resolveQuestion(id: string, answers: QuestionAnswers): void;
  /** ↑ 召回最近一条排队输入（同时应将其从队列移除）；无可召回返回 null */
  recallQueued?(): { text: string } | null;
}
