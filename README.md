# chat-tui

Chat/agent UI components for the terminal, built on [opentui](https://github.com/anomalyco/opentui).

Building a Claude Code / Codex style CLI means rebuilding the same chat surface every time: a multi-line composer with slash-command and mention completion, streaming transcript with thinking and tool-call rendering, approval prompts, layered Ctrl+C semantics. chat-tui packages that surface as reusable components behind one small protocol, and keeps everything agent-specific out.

**View models in, intents out.** chat-tui deliberately knows nothing about sessions, providers, LLM APIs, or wire protocols. Your harness (local agent loop, or a thin client for a remote one) implements `ChatProtocol`; chat-tui renders and interacts.

## Install

```bash
bun add chat-tui @opentui/core @opentui/react react
```

## Quick start

Implement `ChatProtocol` and hand it to `ChatShell`:

```tsx
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { ChatShell, type ChatProtocol, type ChatViewState } from "chat-tui";

class MyHarness implements ChatProtocol {
  // outputs: harness → TUI (snapshot + change notification)
  getView(): ChatViewState { /* transcript, busy, queued, approval, … */ }
  subscribe(onChange: () => void): () => void { /* notify on change */ }

  // inputs: TUI → harness
  submit(text: string) { /* send to local or remote agent */ }
  command(name: string, argument: string) { /* /model, /exit, … */ }
  cancel() { /* interrupt the running turn */ }
  exit() { /* graceful shutdown */ }
  resolvePicker(id: string, value: string | null) { /* … */ }
  resolveApproval(id: string, optionId: string) { /* … */ }
}

const renderer = await createCliRenderer({ exitOnCtrlC: false, autoFocus: false });
createRoot(renderer).render(
  <ChatShell protocol={new MyHarness()} commands={[{ name: "exit", description: "Exit" }]} />,
);
```

Run the full demo (fake streaming harness, no agent required):

```bash
bun install
bun examples/echo.tsx
```

## What you get

- **Composer** — multi-line input: Enter submits, Shift+Enter / Option+Enter / Ctrl+J insert a newline; grows with content; bracketed-paste-safe (via opentui textarea)
- **Completion** — `/` command and `@` mention candidates (Tab complete, ↑↓ select, Esc dismiss); command list and mention sources are injected
- **Transcript** — sticky-bottom scroll; user/agent/thought messages, tool-call cards (status mark, detail lines, live output tail while running), plan checklists; per-item render override for custom tools
- **Steering queue** — queued follow-up inputs rendered with previews; ↑ recalls the latest queued message for editing (the queue itself lives in your harness)
- **Overlays** — picker (model/session/… selection) and approval cards, anchored above the composer
- **Keys** — layered Ctrl+C (interrupt → clear draft → confirm exit), Ctrl+D EOF exit, Esc to interrupt
- **Theme** — one theme object (tokyo-night defaults), overridable per consumer

All interaction logic that can be pure is pure (`triggerAt`, `applyCompletion`, `parseSlashCommand`, `ctrlCAction`) and unit-tested; components stay thin. Use `ChatShell` for the whole surface, or compose `Transcript` / `Composer` / `Suggestions` / `Picker` / `ApprovalCard` / `QueuedList` / `StatusLine` yourself.

## Protocol at a glance

| Direction | Surface | Meaning |
|---|---|---|
| harness → TUI | `getView(): ChatViewState` | full view snapshot: transcript items, busy, queued, picker/approval requests, status, footer |
| harness → TUI | `subscribe(cb)` | change notification; `getView()` must return a stable reference between changes |
| TUI → harness | `submit(text)` | user message (recognized slash commands go to `command()` instead) |
| TUI → harness | `command(name, argument)` | registered slash command invocation |
| TUI → harness | `cancel()` / `exit()` | interrupt turn / graceful shutdown |
| TUI → harness | `resolvePicker(id, value\|null)` / `resolveApproval(id, optionId)` | answers to overlays the harness requested |
| TUI → harness | `recallQueued()` | ↑ recall of the latest queued input |

Transcript items are display-shaped (`message` / `tool_call` / `plan`): your harness reduces its own event stream (Claude SDK, codex app-server, SSE from a remote server, …) into them. That mapping is the only integration work.

## Development

```bash
bun install
bun run check   # typecheck + tests
```

Runtime target is [Bun](https://bun.sh); the package exports TypeScript source directly (no build step), same as consuming opentui from Bun.

## License

Apache-2.0
