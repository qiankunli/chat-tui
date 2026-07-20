# 组件实现约束

## 理念

交互与展示规则优先做成可单测的纯逻辑，React / opentui 组件只负责状态连接和渲染。代码按概念内聚，让维护者读取一个概念时不必跨目录拼接行为。

## 组织方式

- 纯逻辑与渲染同放在 `components/`：可使用同名文件（如 `block.ts`、`clip.ts`、`keys.ts`、`approval.ts`），也可直接放在组件文件内（如 `queuedPreview`、`planWindow`、`composerHeightFor`）。
- `utils/` 只存真正通用的原语。判据是：换一个终端应用后是否仍能原样复用；带 chat-tui 概念的逻辑应留在对应组件旁。
- 新交互先判断能否拆成“纯函数 + 薄组件”，以便对边界和状态转换做稳定单测。

## 全局交互

双击选词是一切可见文本的通性，不是某个 widget 的局部能力。`useTokenSelectionOnDoubleClick` 只在 `ChatShell` 根容器挂一次，通过 opentui 鼠标事件冒泡覆盖后代文本；text / textarea 不应各自注册 selection handler。

上游实现参考 opentui/react；组件形态和工具渲染可参考 pi-mono 与 opencode。
