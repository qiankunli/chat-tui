# AGENTS.md

## 项目定位与边界

chat-tui 是终端 chat/agent 界面的**组件层**（基于 opentui + react）：把 Claude Code / Codex 式 CLI 的交互面——多行输入、slash/@ 补全、流式 transcript、tool 卡片、审批浮层、分层 Ctrl+C——做成可复用组件，接入方实现一个小 protocol 即得到完整 chat TUI。

边界（比"提供什么"更重要）：**不含任何 session / turn / provider / 事件流语义**。那些归接入方的 harness 层。判断新代码该不该进本仓：它是否需要理解"agent 在干什么"？需要 → harness；只关心"怎么画、怎么收输入" → 本仓。

## 代码地图与核心模块

目录布局：`utils/` 只放**真通用原语**；每个概念的**纯逻辑与它的渲染同放在 `components/`**（读一个概念不用跨目录拼）。

```
chat-tui/
├── src/
│   ├── index.ts             # 唯一对外入口（package exports 直指 TS 源码，无构建步骤）
│   ├── protocol/index.ts    # ChatProtocol：视图快照进（getView/subscribe）、intents 出
│   ├── types/index.ts       # 视图模型（TranscriptItem 等）+ Theme
│   ├── utils/               # 只放真通用原语：无 chat-tui 业务语义，换个终端 App 也能用
│   │   ├── text.ts          # 终端文本：显示宽度度量、行清洗、按显示宽度 wrap（clip 与 selection 共用）
│   │   └── time.ts          # 时长格式化（mm:ss / h:mm:ss）
│   └── components/          # 每个概念 = 渲染 + 它自己的纯逻辑（就近同放，纯逻辑照样单测）
│       ├── chat-shell.tsx   # 一站式壳：protocol → 全套组件 + 键盘/焦点/draft 编排
│       ├── keys.ts          # Ctrl+C / Esc 分层语义状态机
│       ├── transcript.tsx   # 时间线：消息 + activity block；内容按预算折叠，Ctrl+O 展开
│       ├── block.ts         # block 展示态双轴（outcome × tone）→ icon/color 合成
│       ├── clip.ts          # 高度预算：ClipPolicy（可注入）+ 按视觉行裁剪
│       ├── diff.ts          # diff 行数与增删统计
│       ├── selection.ts     # 选择几何：token 列范围 / 视觉行定位
│       ├── token-selection.ts # 双击选词的鼠标 hook（只在壳根容器挂一次，靠事件冒泡覆盖全部文本）
│       ├── composer.tsx     # 多行输入框 + ComposerHandle（setText/clear/focus）
│       ├── commands.ts      # slash 命令识别（唯一前缀匹配）
│       ├── completion.ts    # / 与 @ 触发识别、候选构建（命令表/引用源注入）、补全应用
│       ├── overlays.tsx     # Suggestions / Picker / ApprovalCard / QuestionCard（底部锚定浮层）
│       ├── overlay-card.ts  # 浮层卡片统一布局预算：操作/选项行优先保底、详情分剩余、截断留痕
│       ├── approval.ts      # 审批卡布局（overlay-card 实例化）：先留操作行，剩余给详情
│       ├── question.ts      # 问题卡布局（overlay-card 实例化）：选项行优先，焦点详情限行留痕
│       ├── plan-pinned.tsx  # composer 上方的 plan pin + planWindow（对准第一个未完成项）
│       ├── queued.tsx       # steer 队列展示 + queuedPreview
│       ├── run-status.tsx   # 固定运行状态区（elapsed 跳秒自持）+ runStatusParts 文案拼装
│       └── status-line.tsx  # 底部状态行（瞬时 status 优先，回落 footer）
├── examples/echo.tsx        # 假 harness 全交互演示：bun examples/echo.tsx
└── tests/                   # bun test；只测纯逻辑，组件靠 typecheck + example 人工验证
```

运行时 Bun。验证命令：`bun run check`（typecheck + test）。

## 关键约定

- **协议是快照式的**：`getView()` 返回完整 ChatViewState，未变化时必须返回同一引用（ChatShell 走 useSyncExternalStore）。选快照不选增量事件，是为了让本地 harness 与远端转发实现同构、且不用维护 delta 协议版本。
- **TranscriptItem 是"展示形状"不是事件**：普通消息与 activity block 分开；block 只接收 status/tone/kind/title 和已格式化 content，diff、ContentBlock 等结构语义留在接入方，本仓不理解。
- **block 展示态分两根正交轴**：`status`=outcome（pending/in_progress/completed/failed/declined，定 icon）与 `tone`=注意/留痕（warning，覆盖 color）。tone 只改颜色不改 icon——completed+warning 仍是 ✓、不被遮成 ⚠，避免把结果丢成一个 warning。合成在纯函数 `components/block.ts`（可单测），两轴都用查表 + 兜底，新增 outcome 只加一行。
- **认不出就明说认不出**：`status` 是开放 string（容忍 wire 漂移），但未知值**不许**静默落成某个已知待遇——伪装成 in_progress 会和真进行中长得一样，问题永远浮不出来。未知 → 独立图标（`?`）+ 警示色 + `note` 带出原始值供排查。
- **消息来源与正文格式分离**：role/author 只回答谁在说话，`format` 显式选择 plain/markdown；未知来源缺省纯文本，流式 Markdown 的完成边界由接入方通过 `streaming` 提供。
- 能纯则纯：概念的交互/展示逻辑先写成**纯函数**（可单测），组件只做粘合；新交互先问"能不能是纯函数 + 薄组件"。
- **纯逻辑跟着它的概念走**：放在 `components/` 里与其渲染同名同放（`block.ts`/`clip.ts`/`keys.ts`/`approval.ts`…），或直接住在组件文件里（`queuedPreview`/`planWindow`/`composerHeightFor`）。`utils/` 只留真通用原语——判据："换个终端 App 还能原样用吗？"能才进 utils。
- **transcript 高度预算以视觉行计**（宽度 wrap 后的屏幕行），被裁剪内容的 wrap 由 components/clip.ts 负责而非 opentui——"所见行数 == 预算行数"靠这一点保证，改 wrap/度量逻辑必须维持该不变量。折叠是展示层状态（Ctrl+O，不进协议）；数据永不截断，harness 照传全量；复制选择所得是所见（折叠后）内容。
- **运行状态是"现在时"**：`runStatus` 固定在 transcript 与 composer 之间、不进滚动历史（历史只承载过去时）；label 是接入方格式化好的文案，elapsed 跳秒由组件按 `startedAt` 自持，接入方只在状态变化时发快照；author 着色与 transcript 同走 `agentColorFor`。
- **双击选词是一切可见文本的通性，不是单个组件的特性**：`useTokenSelectionOnDoubleClick` 只在壳的根容器挂一次（ChatShell 已挂），靠 opentui 鼠标事件冒泡覆盖全部后代文本；不允许 per-widget 给 text/textarea 自行挂 selection handler。
- textarea 自持内部 buffer，React 侧 draft 只是镜像；清空/覆写必须走 ComposerHandle，两边同步。
- slash 命令表、@ 引用源、theme 都是注入的；本仓不内置任何具体命令语义。
- 上游参考：opentui/react（框架用法）、pi-mono 与 opencode（组件形态与工具渲染参考）。

## References

- `README.md` — 对外文档：protocol 表、快速上手、能力清单
