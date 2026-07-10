#!/usr/bin/env bun
// 最小接入示例：一个假 harness 实现 ChatProtocol，演示 chat-tui 的全部交互。
//   bun examples/echo.tsx
// 试试：输入任意文字（流式回显 + 假工具调用）、/model（picker）、/approve（审批卡片）、
//   Shift+Enter 或 Ctrl+J 换行、跑着时 Esc 打断、Ctrl+C 分层语义、/exit 退出。

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import { ChatShell, type ChatProtocol, type ChatViewState, type CommandSpec, type TranscriptItem } from "../src/index.ts";

const COMMANDS: readonly CommandSpec[] = [
  { name: "model", description: "Pick a model (demo picker)" },
  { name: "approve", description: "Trigger a demo approval card" },
  { name: "exit", description: "Exit" },
];

/** 演示用 harness：submit 后流式回显输入，并伴随一个假工具调用。 */
class EchoHarness implements ChatProtocol {
  private view: ChatViewState = {
    transcript: [],
    header: "chat-tui demo · type to chat · /model picker · /approve approval · /exit quit",
    composerTitle: "model:demo",
    composerPlaceholder: "Message (/ commands, Ctrl+J newline)",
    footer: "chat-tui echo example",
    showThoughts: true,
  };
  private listeners = new Set<() => void>();
  private items: TranscriptItem[] = [];
  private nextId = 1;
  private streaming: ReturnType<typeof setInterval> | null = null;

  getView(): ChatViewState {
    return this.view;
  }

  subscribe(onChange: () => void): () => void {
    this.listeners.add(onChange);
    return () => this.listeners.delete(onChange);
  }

  /** 快照式更新：整体替换 view 对象再通知（getView 的引用稳定性要求） */
  private patch(patch: Partial<ChatViewState>): void {
    this.view = { ...this.view, transcript: [...this.items], ...patch };
    for (const listener of this.listeners) listener();
  }

  submit(text: string): void {
    const id = () => `m_${this.nextId++}`;
    this.items.push({ type: "message", id: id(), role: "user", author: "you", text });
    const thoughtId = id();
    this.items.push({ type: "block", id: thoughtId, kind: "thought", status: "in_progress", title: "Echoing what you said…" });
    const toolId = id();
    this.items.push({
      type: "block",
      id: toolId,
      kind: "tool",
      title: "Running echo --stream",
      status: "in_progress",
      content: { type: "lines", lines: [] },
    });
    const replyId = id();
    this.items.push({ type: "message", id: replyId, role: "agent", author: "echo", text: "" });
    this.patch({ busy: true, runningNotices: ["echo thinking… (Esc to interrupt)"] });

    // 逐字符流式回显，模拟 agent 输出
    let cursor = 0;
    this.streaming = setInterval(() => {
      cursor++;
      const reply = this.items.find((item): item is TranscriptItem & { type: "message" } => item.id === replyId && item.type === "message");
      const thought = this.items.find((item): item is TranscriptItem & { type: "block" } => item.id === thoughtId && item.type === "block");
      const tool = this.items.find((item): item is TranscriptItem & { type: "block" } => item.id === toolId && item.type === "block");
      if (reply) reply.text = text.slice(0, cursor);
      if (tool) tool.content = { type: "lines", lines: [`echoed ${cursor}/${text.length} chars`] };
      if (cursor >= text.length) {
        this.stopStreaming();
        if (thought) thought.status = "completed";
        if (tool) {
          tool.status = "completed";
          tool.title = "Ran echo --stream";
        }
        this.patch({ busy: false, runningNotices: [] });
        return;
      }
      this.patch({});
    }, 60);
  }

  command(name: string, argument: string): void {
    if (name === "exit") {
      void this.exit();
      return;
    }
    if (name === "model") {
      this.patch({
        picker: {
          id: "picker_model",
          title: "Select model (demo)",
          options: [
            { name: "fast", description: "low latency", value: "fast" },
            { name: "smart", description: "high quality", value: "smart" },
          ],
        },
      });
      return;
    }
    if (name === "approve") {
      this.patch({
        approval: {
          id: "approval_demo",
          title: `Run "rm -rf ${argument || "/tmp/demo"}"?`,
          options: [
            { optionId: "yes", name: "Allow", kind: "allow_once" },
            { optionId: "no", name: "Deny", kind: "reject_once" },
          ],
        },
      });
    }
  }

  cancel(): void {
    if (!this.view.busy) return;
    this.stopStreaming();
    for (const item of this.items) {
      if (item.type === "block" && item.status === "in_progress") item.status = "failed";
    }
    this.patch({ busy: false, runningNotices: [], status: { text: "Interrupted", tone: "info" } });
  }

  exit(): void {
    this.stopStreaming();
    process.exit(0);
  }

  resolvePicker(_id: string, value: string | null): void {
    this.patch({
      picker: null,
      composerTitle: value ? `model:${value}` : this.view.composerTitle,
      status: value ? { text: `Model set to ${value}`, tone: "info" } : null,
    });
  }

  resolveApproval(_id: string, optionId: string): void {
    this.patch({ approval: null, status: { text: `Approval answered: ${optionId}`, tone: "info" } });
  }

  private stopStreaming(): void {
    if (this.streaming) clearInterval(this.streaming);
    this.streaming = null;
  }
}

if (!process.stdout.isTTY) {
  console.error("chat-tui example requires a real terminal (TTY)");
  process.exit(1);
}
// Ctrl+C 由 ChatShell 接管（分层语义）；autoFocus=false 防止鼠标点击把焦点从输入框抢走
const renderer = await createCliRenderer({ exitOnCtrlC: false, targetFps: 30, autoFocus: false });
createRoot(renderer).render(<ChatShell protocol={new EchoHarness()} commands={COMMANDS} />);
