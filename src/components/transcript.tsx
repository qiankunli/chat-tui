import { useRenderer, useSelectionHandler } from "@opentui/react";
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
  const renderer = useRenderer();
  useSelectionHandler((selection) => {
    const selectedText = selection.getSelectedText();
    if (selectedText) renderer.copyToClipboardOSC52(selectedText);
  });
  return (
    <scrollbox style={{ flexGrow: 1, paddingLeft: 1, paddingRight: 1 }} stickyScroll stickyStart="bottom" focused={false}>
      {props.header ? <text fg={theme.dim} selectable>{`${props.header}\n`}</text> : null}
      {props.items.map((item) => {
        const custom = props.renderItem?.(item);
        if (custom !== undefined) return custom;
        return renderDefault(item, theme, props.showThoughts ?? true);
      })}
      {(props.runningNotices ?? []).map((notice) => (
        <text key={notice} fg={theme.dim} selectable>{`\n${notice}`}</text>
      ))}
    </scrollbox>
  );
}

function renderDefault(item: TranscriptItem, theme: Theme, showThoughts: boolean): ReactNode {
  if (item.type === "message") {
    const author = item.author ?? (item.role === "user" ? "you" : "agent");
    const color =
      item.role === "user" ? theme.user : (theme.agentColorFor?.(author) ?? theme.agent);
    return (
      <text key={item.id} selectable>
        <span fg={color}>{`\n${author}> `}</span>
        {item.text}
      </text>
    );
  }
  if (item.kind === "thought" && !showThoughts) return null;
  const { icon, color } = blockStatus(item.status, item.kind, theme);
  const content = blockContentLines(item.content);
  // Keep one text renderable mounted while a running block gains output. OpenTUI can
  // otherwise leave cells from the old two-row flex layout behind during reflow.
  return (
    <text key={item.id} style={{ marginTop: 1 }} selectable>
      <span fg={color}>{`${icon} ${item.title}`}</span>
      {content.length > 0 ? (
        <span fg={item.kind === "thought" ? theme.dim : theme.tool}>
          {"\n"}
          {content.map((line, index) => `${index === 0 ? "  └ " : "    "}${line}`).join("\n")}
        </span>
      ) : null}
    </text>
  );
}

function blockStatus(status: string, kind: string, theme: Theme): { icon: string; color: string } {
  if (status === "failed") return { icon: "✗", color: theme.error };
  if (status === "completed") return { icon: "✓", color: theme.success };
  const color = kind === "thought" ? theme.dim : kind === "plan" ? theme.plan : theme.tool;
  return status === "pending" ? { icon: "○", color } : { icon: "•", color };
}

function blockContentLines(content: Extract<TranscriptItem, { type: "block" }>["content"]): string[] {
  if (!content) return [];
  if (content.type === "text") return content.text.split("\n").filter(Boolean);
  if (content.type === "lines") return content.lines.map((line) => line.slice(0, TAIL_LINE_MAX_CHARS));
  const markOf = (status: string): string =>
    status === "completed" ? "☑" : status === "in_progress" ? "◐" : "☐";
  return content.entries.map((entry) => `${markOf(entry.status)} ${entry.content}`);
}
