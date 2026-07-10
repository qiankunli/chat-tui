# AGENTS.md

## 项目定位与边界

chat-tui 是终端 chat/agent 界面的**组件层**（基于 opentui + react）：把 Claude Code / Codex 式 CLI 的交互面——多行输入、slash/@ 补全、流式 transcript、tool 卡片、审批浮层、分层 Ctrl+C——做成可复用组件，接入方实现一个小 protocol 即得到完整 chat TUI。

边界（比"提供什么"更重要）：**不含任何 session / turn / provider / 事件流语义**。那些归接入方的 harness 层。判断新代码该不该进本仓：它是否需要理解"agent 在干什么"？需要 → harness；只关心"怎么画、怎么收输入" → 本仓。

## 代码地图与核心模块

目录布局对齐 opentui 的包习惯（src/{components,types,utils} + 顶层 tests/examples）：

```
chat-tui/
├── src/
│   ├── index.ts             # 唯一对外入口（package exports 直指 TS 源码，无构建步骤）
│   ├── protocol/index.ts    # ChatProtocol：视图快照进（getView/subscribe）、intents 出
│   ├── types/index.ts       # 视图模型（TranscriptItem 等）+ Theme
│   ├── utils/               # 纯逻辑，全部可单测
│   │   ├── completion.ts    # / 与 @ 触发识别、候选构建（命令表/引用源注入）、补全应用
│   │   ├── commands.ts      # slash 命令识别（唯一前缀匹配）
│   │   └── keys.ts          # Ctrl+C 分层语义状态机
│   └── components/
│       ├── chat-shell.tsx   # 一站式壳：protocol → 全套组件 + 键盘/焦点/draft 编排
│       ├── transcript.tsx   # 时间线：消息 + activity block（状态/类型/标题/内容），renderItem 可逐条覆盖
│       ├── composer.tsx     # 多行输入框 + ComposerHandle（setText/clear/focus）
│       ├── overlays.tsx     # Suggestions / Picker / ApprovalCard（底部锚定浮层）
│       ├── queued.tsx       # steer 队列展示 + queuedPreview 纯函数
│       └── status-line.tsx  # 底部状态行（瞬时 status 优先，回落 footer）
├── examples/echo.tsx        # 假 harness 全交互演示：bun examples/echo.tsx
└── tests/                   # bun test；只测纯逻辑，组件靠 typecheck + example 人工验证
```

运行时 Bun。验证命令：`bun run check`（typecheck + test）。

## 关键约定

- **协议是快照式的**：`getView()` 返回完整 ChatViewState，未变化时必须返回同一引用（ChatShell 走 useSyncExternalStore）。选快照不选增量事件，是为了让本地 harness 与远端转发实现同构、且不用维护 delta 协议版本。
- **TranscriptItem 是"展示形状"不是事件**：普通消息与 activity block 分开；block 只接收 status/kind/title 和已格式化 content，diff、ContentBlock 等结构语义留在接入方，本仓不理解。
- 能纯则纯：交互逻辑先写成 utils/ 纯函数（可单测），组件只做粘合；新交互先问"能不能是纯函数 + 薄组件"。
- textarea 自持内部 buffer，React 侧 draft 只是镜像；清空/覆写必须走 ComposerHandle，两边同步。
- slash 命令表、@ 引用源、theme 都是注入的；本仓不内置任何具体命令语义。
- 上游参考：opentui/react（框架用法）、pi-mono 与 opencode（组件形态与工具渲染参考）。

## References

- `README.md` — 对外文档：protocol 表、快速上手、能力清单
