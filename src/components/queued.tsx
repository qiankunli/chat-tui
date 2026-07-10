import type { ReactNode } from "react";

import { defaultTheme, type QueuedItem, type Theme } from "../types/index.ts";

/** 队列条目的三行预览（↳ 首行缩进，超出折叠为 …） */
export function queuedPreview(text: string): string {
  const lines = text.split("\n");
  const visible = lines.slice(0, 3).map((line, index) => `${index === 0 ? "  ↳ " : "    "}${line}`);
  if (lines.length > 3) visible.push("    …");
  return visible.join("\n");
}

export interface QueuedListProps {
  items: QueuedItem[];
  /** 底部操作提示，如 "↑ edit last queued message" */
  hint?: string;
  theme?: Theme;
}

/** 排队中的 steer 输入列表。召回/编辑/撤销的交互归消费方（队列本体在 harness 层）。 */
export function QueuedList(props: QueuedListProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  if (props.items.length === 0) return null;
  return (
    <box style={{ flexDirection: "column", flexShrink: 0, paddingLeft: 1, paddingRight: 1 }}>
      <text>• Queued follow-ups</text>
      {props.items.map((item) => (
        <text key={item.id} fg={theme.dim}>
          {`${queuedPreview(item.text)}${item.tag ? `  [${item.tag}]` : ""}`}
        </text>
      ))}
      {props.hint ? <text fg={theme.dim}>{props.hint}</text> : null}
    </box>
  );
}
