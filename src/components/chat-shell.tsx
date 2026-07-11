// ChatShell：把 ChatProtocol 接到全套组件上的一站式壳。
// 接入方只需实现 ChatProtocol + 注入命令表/引用源，即得到完整 chat TUI：
// 多行输入、slash/@ 补全、分层 Ctrl+C、队列召回、picker/审批浮层。

import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import type { ChatProtocol } from "../protocol/index.ts";
import { defaultTheme, type CommandSpec, type StatusMessage, type Theme } from "../types/index.ts";
import type { ClipPolicy } from "../utils/clip.ts";
import { parseSlashCommand } from "../utils/commands.ts";
import { applyCompletion, buildCandidates, triggerAt, type Candidate } from "../utils/completion.ts";
import { CTRL_C_CONFIRM_WINDOW_MS, ctrlCAction } from "../utils/keys.ts";
import { Composer, composerHeightFor, type ComposerHandle } from "./composer.tsx";
import { ApprovalCard, Picker, Suggestions } from "./overlays.tsx";
import { QueuedList } from "./queued.tsx";
import { StatusLine } from "./status-line.tsx";
import { Transcript } from "./transcript.tsx";

export interface ChatShellProps {
  protocol: ChatProtocol;
  /** slash 命令表（补全 + 识别）；语义执行走 protocol.command() */
  commands: readonly CommandSpec[];
  /** @ 引用候选源；不传则 @ 不触发补全 */
  mentions?: (prefix: string) => Candidate[];
  theme?: Theme;
  /** transcript 高度预算策略；缺省 defaultClipPolicy（Ctrl+O 展开/收起） */
  clipPolicy?: ClipPolicy;
}

export function ChatShell(props: ChatShellProps): ReactNode {
  const { protocol } = props;
  const theme = props.theme ?? defaultTheme;
  const view = useSyncExternalStore(
    useCallback((onChange) => protocol.subscribe(onChange), [protocol]),
    () => protocol.getView(),
  );

  const [draft, setDraft] = useState("");
  const composer = useRef<ComposerHandle | null>(null);
  // 本地瞬时提示（Ctrl+C 二次确认等）；接入方的 view.status 优先级更高
  const [localStatus, setLocalStatus] = useState<StatusMessage | null>(null);
  const [suggIdx, setSuggIdx] = useState(0);
  const [suggDismissed, setSuggDismissed] = useState(false);
  const ctrlCArmedAt = useRef(0);

  const resetComposer = useCallback(() => {
    // textarea 自持内部 buffer，draft 只是镜像（供候选推导/按键分层用），两边都要清
    setDraft("");
    composer.current?.clear();
  }, []);

  // 候选由输入实时推导（/ 行首=命令，@ =引用），无独立状态需要同步
  const trigger = triggerAt(draft);
  const approval = view.approval ?? null;
  const picker = view.picker ?? null;
  const candidates =
    trigger && !suggDismissed && !approval && !picker
      ? buildCandidates(trigger, { commands: props.commands, mentions: props.mentions })
      : [];
  const sel = candidates.length ? Math.min(suggIdx, candidates.length - 1) : 0;

  // 焦点安全网：浮层都关闭时确保焦点回到输入框。focused prop 只在值变化时生效，
  // 覆盖不到"焦点被别处拿走但 prop 没变"的场景；focus() 对已聚焦者是 no-op，代价可忽略。
  useEffect(() => {
    if (!approval && !picker) composer.current?.focus();
  });

  const send = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      resetComposer();
      setLocalStatus(null);
      try {
        const command = parseSlashCommand(trimmed, props.commands);
        if (command) await protocol.command(command.name, command.argument);
        else await protocol.submit(trimmed);
      } catch (error) {
        setLocalStatus({ text: error instanceof Error ? error.message : String(error), tone: "error" });
      }
    },
    [props.commands, protocol, resetComposer],
  );

  const busy = view.busy ?? false;

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      // TUI 惯例：Ctrl+C 是"打断"不是"退出"——跑着中断、有输入清空、空闲二次确认
      const action = ctrlCAction({ busy, hasDraft: draft !== "", armedAt: ctrlCArmedAt.current, now: Date.now() });
      if (action === "cancel-turn") protocol.cancel();
      else if (action === "clear-draft") {
        resetComposer();
        setSuggIdx(0);
      } else if (action === "exit") void protocol.exit();
      else {
        ctrlCArmedAt.current = Date.now();
        setLocalStatus({ text: "Press Ctrl+C again to exit", tone: "info" });
        setTimeout(
          () => setLocalStatus((current) => (current?.text === "Press Ctrl+C again to exit" ? null : current)),
          CTRL_C_CONFIRM_WINDOW_MS + 100,
        );
      }
      return;
    }
    if (key.ctrl && key.name === "d") {
      // shell 习惯：空输入时 EOF 即退出
      if (!draft && !busy) void protocol.exit();
      return;
    }
    if (key.name === "escape" && picker && !approval) {
      key.preventDefault();
      protocol.resolvePicker(picker.id, null);
      return;
    }
    if (candidates.length > 0 && ["down", "up", "tab", "escape"].includes(key.name)) {
      // 候选浮层：↑/↓ 选择，Tab 补全（Enter 保留"发送"语义），Esc 关闭
      // 全局 handler 先于聚焦 renderable 执行；preventDefault 阻止 textarea 把 ↑/↓/Tab 当编辑键
      key.preventDefault();
      if (key.name === "down") setSuggIdx((i) => (i + 1) % candidates.length);
      else if (key.name === "up") setSuggIdx((i) => (i - 1 + candidates.length) % candidates.length);
      else if (key.name === "tab" && trigger) {
        const chosen = candidates[sel];
        if (chosen) {
          const next = applyCompletion(draft, trigger, chosen);
          setDraft(next);
          composer.current?.setText(next);
          setSuggIdx(0);
        }
      } else if (key.name === "escape") setSuggDismissed(true);
      return;
    }
    if (key.name === "up" && !draft && !approval && !picker) {
      const recalled = protocol.recallQueued?.();
      if (recalled) {
        key.preventDefault();
        setDraft(recalled.text);
        composer.current?.setText(recalled.text);
        setLocalStatus({ text: "Recalled queued message; edit and resend", tone: "info" });
        return;
      }
    }
    if (key.name === "escape" && busy) protocol.cancel();
  });

  // 输入区随内容长高；浮层锚点跟着输入框顶部走（+1 是底部状态行）
  const overlayBottom = composerHeightFor(draft) + 1;

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <Transcript
        header={view.header}
        items={view.transcript}
        runningNotices={view.runningNotices}
        showThoughts={view.showThoughts}
        theme={theme}
        clipPolicy={props.clipPolicy}
      />

      <QueuedList items={view.queued ?? []} hint={view.queuedHint} theme={theme} />

      <Composer
        ref={composer}
        title={view.composerTitle}
        placeholder={view.composerPlaceholder}
        focused={!approval && !picker}
        busy={busy}
        theme={theme}
        onChange={(text) => {
          setDraft(text);
          setSuggDismissed(false);
          setSuggIdx(0);
        }}
        onSubmit={(text) => void send(text)}
      />

      <Suggestions candidates={candidates} selectedIndex={sel} anchorBottom={overlayBottom} theme={theme} />

      <StatusLine status={localStatus ?? view.status ?? null} fallback={view.footer ?? ""} theme={theme} />

      {picker && !approval && (
        <Picker
          picker={picker}
          anchorBottom={overlayBottom}
          theme={theme}
          onSelect={(value) => protocol.resolvePicker(picker.id, value)}
        />
      )}

      {approval && (
        <ApprovalCard
          approval={approval}
          anchorBottom={overlayBottom}
          theme={theme}
          onSelect={(optionId) => protocol.resolveApproval(approval.id, optionId)}
        />
      )}
    </box>
  );
}
