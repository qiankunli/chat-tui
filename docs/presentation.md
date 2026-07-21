# 界面区块与展示语义

## 理念

界面自上而下按信息的时态与寿命分层：越接近现在的信息越靠下、越固定，不随历史滚动。展示层可以压缩信息，但不能改写事实；不同维度保持正交，未知输入显式暴露，裁剪只影响当前视图而不截断接入方传入的数据。

带方括号的区块是条件渲染，无内容时不占高度：

```text
Transcript        可滚动历史（过去时）
[Plan]            进行中的计划
[Queued]          待执行输入（将来时）
Composer          持续可编辑的输入区（现在时）
  ├ [Provider Status] 当前输入目标与运行状态
  └ [Overlay]      补全、选择、审批或结构化问题
[Feedback]        短寿命操作回执或错误
Footer            常驻状态
```

## Transcript

Transcript 是可滚动的过去时区域，接收 message 与 activity block 两类展示形状。接入方负责把事件投影成展示内容，chat-tui 不解释 provider 语义。

- activity block 的 `status` 表示 outcome（pending / in_progress / completed / failed / declined），决定 icon；`tone` 表示注意或留痕，覆盖 color。tone 不改变结果，例如 completed + warning 仍显示完成图标。两轴在 `components/block.ts` 通过查表与兜底合成。
- `status` 是容忍 wire 漂移的开放 string。未知值不得降级成某个已知状态，而应使用独立图标、警示色，并在 note 中保留原始值。
- 消息来源与正文格式分离：role / author 只回答谁在说话，`format` 显式选择 plain / markdown；未知来源缺省纯文本，流式 Markdown 的完成边界由接入方通过 `streaming` 提供。
- transcript 高度预算按宽度 wrap 后的视觉行计算，由 `components/clip.ts` 保证“所见行数等于预算行数”。diff 作为文件改动结果默认完整展示，其余被折叠的内容可用 Ctrl+O 展开；折叠是本地展示状态（不进协议），harness 始终传完整数据，复制选择得到当前所见内容。

## Plan

`PlanPinned` 位于 transcript 与 queued input 之间，展示接入方下发的当前计划；空数组即隐藏。是否下发、何时撤下由 harness 决定，chat-tui 只负责非空渲染。超长计划的窗口对准第一个未完成项，使当前进度保持可见。

## Queued

`QueuedList` 展示等待执行的输入快照，是将来时区域；队列本体、顺序和召回语义归 harness。列表为空时不渲染，召回后的内容回到 Composer 继续编辑。

## Composer

Composer 是固定在历史区下方、供用户持续组织和修改输入的创作面，不是只在 agent 空闲时开放的一次性提交框。它包含可选的 Provider Status、输入框及贴近输入框的 overlays；设计优先级始终偏向方便用户表达，并保护尚未提交的输入。

输入区遵守以下不变量：

1. **输出与输入可以同时发生**：transcript 仍在流式更新时，用户也可能已经开始准备下一条输入。transcript 或运行状态更新不得抢走焦点、覆盖或清空 draft，也不得阻塞继续编辑；agent 是否忙只影响提交后的路由，不影响输入本身。
2. **多行是输入语义的一部分**：换行、光标位置和未提交 draft 必须完整保留；高度调整、补全、历史或队列召回等交互不能意外归一化或丢失这些内容。
3. **编辑状态只有一个权威修改通道**：textarea 自持内部 buffer，React 侧 draft 只是用于候选推导和按键分层的镜像。清空或覆写必须经过 `ComposerHandle`，确保两侧同步，不能因外部快照刷新重建用户输入。

- Provider Status 描述当前输入目标与运行相位，是 composer 的组成部分而非独立历史层。`runStatus` 的 label 由接入方格式化，elapsed 根据 `startedAt` 在组件内跳秒，author 着色与 transcript 共用 `agentColorFor`。
- Suggestions、Picker、ApprovalCard 与 QuestionCard 锚定输入区显示；请求排队和业务语义归 harness，chat-tui 只呈现当前请求并回传用户 intent。

Composer 体验不是封闭的功能清单。后续发现新的输入便利能力时继续沉淀在本节，并判断它是否减少输入过程的打断、保护已有内容和编辑意图，以及避免把可用性绑定到 transcript 或 agent 的运行状态。

## Feedback 与 Footer

Feedback 来自 `status`，只承载短寿命操作回执或错误，有内容时显示在 Footer 上方。Footer 来自 `footer`，承载用户随时可查的常驻状态；Feedback 出现时不得替换或隐藏 Footer。需要长期回看的信息应进入 Transcript，而不是停留在 Feedback。
