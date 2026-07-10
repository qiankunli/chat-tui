import type { ReactNode } from "react";

import { defaultTheme, type Theme, type TranscriptItem } from "../types/index.ts";

export interface TranscriptProps {
  /** 顶部说明文字（产品名、快捷键提示等），dim 展示 */
  header?: string;
  items: TranscriptItem[];
  /** 展示"xx thinking…"一类的运行中提示行 */
  runningNotices?: string[];
  /** thought 消息是否渲染（对应 show-thoughts 配置） */
  showThoughts?: boolean;
  theme?: Theme;
  /** 逐条自定义渲染；返回 undefined 时走默认渲染 */
  renderItem?: (item: TranscriptItem) => ReactNode | undefined;
}

const TAIL_LINE_MAX_CHARS = 120;

/** 对话时间线：滚动区 + 消息/工具/计划的默认渲染。粘底滚动，流式期间自动跟随。 */
export function Transcript(props: TranscriptProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  return (
    <scrollbox style={{ flexGrow: 1, paddingLeft: 1, paddingRight: 1 }} stickyScroll stickyStart="bottom" focused={false}>
      {props.header ? <text fg={theme.dim}>{`${props.header}\n`}</text> : null}
      {props.items.map((item) => {
        const custom = props.renderItem?.(item);
        if (custom !== undefined) return custom;
        return renderDefault(item, theme, props.showThoughts ?? true);
      })}
      {(props.runningNotices ?? []).map((notice) => (
        <text key={notice} fg={theme.dim}>{`\n${notice}`}</text>
      ))}
    </scrollbox>
  );
}

function renderDefault(item: TranscriptItem, theme: Theme, showThoughts: boolean): ReactNode {
  if (item.type === "message") {
    if (item.role === "thought") {
      if (!showThoughts) return null;
      const text = item.text.trim();
      if (!text) return null;
      return (
        <text key={item.id} fg={theme.dim}>
          {`\n∴ ${text}`}
        </text>
      );
    }
    const author = item.author ?? (item.role === "user" ? "you" : "agent");
    const color =
      item.role === "user" ? theme.user : (theme.agentColorFor?.(author) ?? theme.agent);
    return (
      <text key={item.id}>
        <span fg={color}>{`\n${author}> `}</span>
        {item.text}
      </text>
    );
  }
  if (item.type === "tool_call") {
    const mark = item.status === "completed" ? "✓" : item.status === "failed" ? "✗" : "⋯";
    const lines = [`  ${mark} ${item.title ?? item.id}`];
    for (const detail of item.detailLines ?? []) lines.push(`      ${detail}`);
    if (item.status === "in_progress") {
      // 运行中的命令：展示输出尾巴，完成后收起保持时间线干净
      for (const tail of item.tailLines ?? []) lines.push(`      │ ${tail.slice(0, TAIL_LINE_MAX_CHARS)}`);
    }
    return <text key={item.id} fg={theme.tool}>{lines.join("\n")}</text>;
  }
  const markOf = (s: string): string => (s === "completed" ? "☑" : s === "in_progress" ? "◐" : "☐");
  return (
    <text key={item.id} fg={theme.plan}>
      {`\n  Plan\n${item.entries.map((e) => `  ${markOf(e.status)} ${e.content}`).join("\n")}`}
    </text>
  );
}
