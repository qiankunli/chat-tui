// chat-tui：终端 chat/agent 界面的组件层。视图模型进、用户意图（intents）出——
// UI 只上报"用户想干什么"（submit/cancel/command…），不执行也不解释，
// 不含任何 session / provider / 事件流语义——那些归消费方的 harness。

export * from "./types/index.ts";
export * from "./protocol/index.ts";
export * from "./utils/clip.ts";
export * from "./utils/diff.ts";
export * from "./utils/commands.ts";
export * from "./utils/completion.ts";
export * from "./utils/elapsed.ts";
export * from "./utils/keys.ts";
export { ChatShell, type ChatShellProps } from "./components/chat-shell.tsx";
export { Transcript, type TranscriptProps } from "./components/transcript.tsx";
export {
  Composer,
  COMPOSER_KEY_BINDINGS,
  composerHeightFor,
  type ComposerHandle,
  type ComposerProps,
} from "./components/composer.tsx";
export {
  ApprovalCard,
  Picker,
  QuestionCard,
  Suggestions,
  type ApprovalCardProps,
  type PickerProps,
  type QuestionCardProps,
  type SuggestionsProps,
} from "./components/overlays.tsx";
export { PlanPinned, planWindow, type PlanPinnedProps, type PlanWindow } from "./components/plan-pinned.tsx";
export { QueuedList, queuedPreview, type QueuedListProps } from "./components/queued.tsx";
export { RunStatus, type RunStatusProps } from "./components/run-status.tsx";
export { StatusLine, type StatusLineProps } from "./components/status-line.tsx";
