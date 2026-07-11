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
- **Transcript** — sticky-bottom scroll; user/agent messages plus unified activity blocks (`status + kind + title + content`) for thoughts, tools, plans, and custom activity; per-item render override remains available
- **Height budget** — long block content is clipped to a visual-row budget (wrap-aware, so one long line can't flood the viewport): running output follows the tail, finished output keeps head+tail, diffs/commands keep the head; `… +N lines (ctrl+o to expand)` hints and Ctrl+O toggles full view; the clip policy is injectable (`clipPolicy`) and data is never truncated — display only
- **Steering queue** — queued follow-up inputs rendered with previews; ↑ recalls the latest queued message for editing (the queue itself lives in your harness)
- **Overlays** — picker (model/session/… selection) and approval cards, anchored above the composer
- **Keys** — layered Ctrl+C (interrupt → clear draft → confirm exit), Ctrl+D EOF exit, Esc to interrupt, Ctrl+O expand/collapse clipped blocks
- **Theme** — one theme object (tokyo-night defaults), overridable per consumer

All interaction logic that can be pure is pure (`triggerAt`, `applyCompletion`, `parseSlashCommand`, `ctrlCAction`) and unit-tested; components stay thin. Use `ChatShell` for the whole surface, or compose `Transcript` / `Composer` / `Suggestions` / `Picker` / `ApprovalCard` / `QueuedList` / `StatusLine` yourself.

## Capability matrix

chat-tui describes UI capabilities, not provider capabilities. A check here means the UI can collect or render the shape; the harness still decides whether an agent provider supports the operation and how to map it.

### User → harness

| Interaction | UI surface | Support | Boundary |
|---|---|---|---|
| Text message | Composer → `submit(text)` | Yes | Text only; attachments and structured content are not modeled |
| Model switch | `picker` + `resolvePicker()`, or a command | UI only | There is no model concept in chat-tui; discovery, current selection, and application belong to the harness |
| Harness/product slash command | Completion → `command(name, argument)` | Yes | The command registry and semantics are injected by the harness |
| Provider-compatible slash command | Same `command()` intent | UI only | chat-tui does not distinguish ownership; the harness must discover and route provider commands explicitly |
| Interrupt | Esc / Ctrl+C → `cancel()` | Yes | The harness maps it to the provider's cancel/interrupt operation |
| Queued follow-up | `queued` + `recallQueued()` | Yes | Display and recall only; the harness owns the queue |
| Same-turn steer | No distinct intent | No | A queued follow-up is not the same as steering an active provider turn |
| Generic single choice | `picker` → `resolvePicker()` | Yes | One question, one option, or dismiss; suitable for model/session selection |
| Permission decision | `approval` → `resolveApproval()` | Yes | One request with provider-defined options; intentionally not dismissible |
| Structured agent question | — | No | Multiple questions, multi-select, free text/“Other”, secret input, and previews need a separate view model |
| Structured elicitation/form | — | No | Arbitrary MCP/provider forms are outside the current protocol |

### Harness → user

| Output | View shape | Support | Boundary |
|---|---|---|---|
| User/agent text | `TranscriptItem.message` | Yes | Plain text display shape |
| Streaming updates | Repeated immutable `ChatViewState` snapshots | Yes | The harness reduces provider deltas before publishing a snapshot |
| Thought/tool/plan/custom activity | `TranscriptItem.block` | Yes | `kind` is open; chat-tui does not interpret provider events |
| Block content | `text` / `lines` / `plan` / `code` / `command` / `output` / `diff` | Yes | Code uses Tree-sitter syntax highlighting; diff uses the native unified diff renderer |
| Long content | Clipped to a visual-row budget, Ctrl+O expands | Yes | Pass full content; clipping is display-only and the policy (`clipPolicy`) is injectable |
| Provider status and usage | `runningNotices` / `status` / `footer` | Yes | Preformatted strings; semantics stay in the harness |
| Provider request for action | `picker` / `approval` | Partial | Simple choice and permission are covered; structured questions/dialogs/forms are not |

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

Transcript items are display-shaped (`message` / `block`): your harness reduces its own event stream (Claude SDK, codex app-server, SSE from a remote server, …) into them. A block carries a status, open-ended kind, title, and optional display-ready content; provider-specific event and content-block semantics stay in the harness.

## Development

```bash
bun install
bun run check   # typecheck + tests
```

Runtime target is [Bun](https://bun.sh); the package exports TypeScript source directly (no build step), same as consuming opentui from Bun.

## License

Apache-2.0
