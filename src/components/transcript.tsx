import { getTreeSitterClient, pathToFiletype, SyntaxStyle, treeSitterToStyledText, type StyledText } from "@opentui/core";
import { useRenderer, useSelectionHandler } from "@opentui/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { defaultTheme, type Theme, type TranscriptBlockContent, type TranscriptItem } from "../types/index.ts";

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
  const syntaxStyle = useMemo(() => syntaxStyleFor(theme), [theme]);
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
        return renderDefault(item, theme, syntaxStyle, props.showThoughts ?? true);
      })}
      {(props.runningNotices ?? []).map((notice) => (
        <text key={notice} fg={theme.dim} selectable>{`\n${notice}`}</text>
      ))}
    </scrollbox>
  );
}

function renderDefault(item: TranscriptItem, theme: Theme, syntaxStyle: SyntaxStyle, showThoughts: boolean): ReactNode {
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
  const contents = item.content ? (Array.isArray(item.content) ? item.content : [item.content]) : [];
  const rich = contents.some(
    (content) => content.type === "code" || content.type === "command" || content.type === "diff",
  );
  if (rich) {
    return (
      <box key={item.id} style={{ flexDirection: "column", marginTop: 1 }}>
        <text selectable>
          <span fg={color}>{icon}</span>
          <strong>{` ${item.title}`}</strong>
        </text>
        {contents.map((content, index) => renderRichContent(content, `${item.id}:${index}`, theme, syntaxStyle))}
      </box>
    );
  }
  // output 段用弱化色与其余内容区分；逐行 span 以支持同一 block 内混排不同类型
  const lines = contents.flatMap((piece) =>
    blockContentLines(piece).map((line) => ({ line, dim: piece.type === "output" })),
  );
  // Keep one text renderable mounted while a running block gains output. OpenTUI can
  // otherwise leave cells from the old two-row flex layout behind during reflow.
  return (
    <text key={item.id} style={{ marginTop: 1 }} selectable>
      <span fg={color}>{icon}</span>
      <strong>{` ${item.title}`}</strong>
      {lines.map((entry, index) => (
        <span key={index} fg={item.kind === "thought" || entry.dim ? theme.dim : theme.tool}>
          {`\n${index === 0 ? "  └ " : "    "}${entry.line}`}
        </span>
      ))}
    </text>
  );
}

function renderRichContent(
  content: TranscriptBlockContent,
  key: string,
  theme: Theme,
  syntaxStyle: SyntaxStyle,
): ReactNode {
  if (content.type === "code" || content.type === "command") {
    return (
      <HighlightedCode
        key={key}
        code={content.type === "command" ? content.command : content.code}
        language={content.type === "command" ? (content.language ?? "bash") : content.language}
        fallbackColor={theme.tool}
        syntaxStyle={syntaxStyle}
      />
    );
  }
  if (content.type === "diff") {
    return (
      <diff
        key={key}
        diff={content.patch}
        view="unified"
        filetype={content.path ? pathToFiletype(content.path) : undefined}
        syntaxStyle={syntaxStyle}
        showLineNumbers={false}
        wrapMode="none"
        addedBg={theme.diffAddedBg ?? "transparent"}
        removedBg={theme.diffRemovedBg ?? "transparent"}
        contextBg="transparent"
        addedSignColor={theme.success}
        removedSignColor={theme.error}
        style={{ marginLeft: 4, width: "100%", height: sourceLineCount(content.patch) }}
      />
    );
  }
  const lines = blockContentLines(content);
  return lines.length > 0 ? (
    <text key={key} fg={content.type === "output" ? theme.dim : theme.tool} style={{ marginLeft: 4 }} selectable>
      {lines.join("\n")}
    </text>
  ) : null;
}

function HighlightedCode(props: {
  code: string;
  language: string;
  fallbackColor: string;
  syntaxStyle: SyntaxStyle;
}): ReactNode {
  const [content, setContent] = useState<string | StyledText>(props.code);
  useEffect(() => {
    let active = true;
    setContent(props.code);
    void treeSitterToStyledText(props.code, props.language, props.syntaxStyle, getTreeSitterClient(), {
      conceal: { enabled: false },
    })
      .then((highlighted) => {
        if (active) setContent(highlighted);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [props.code, props.language, props.syntaxStyle]);
  return <text content={content} fg={props.fallbackColor} style={{ marginLeft: 4 }} selectable />;
}

function sourceLineCount(source: string): number {
  return Math.max(1, source.replace(/\n$/, "").split("\n").length);
}

function syntaxStyleFor(theme: Theme): SyntaxStyle {
  return SyntaxStyle.fromStyles({
    default: { fg: theme.tool },
    keyword: { fg: theme.agent, bold: true },
    string: { fg: theme.success },
    comment: { fg: theme.dim, italic: true },
    number: { fg: theme.plan },
    variable: { fg: theme.user },
    function: { fg: theme.accent },
    operator: { fg: theme.error },
    property: { fg: theme.plan },
    type: { fg: theme.plan },
    punctuation: { fg: theme.dim },
  });
}

function blockStatus(status: string, kind: string, theme: Theme): { icon: string; color: string } {
  if (status === "failed") return { icon: "✗", color: theme.error };
  if (status === "completed") return { icon: "✓", color: theme.success };
  const color = kind === "thought" ? theme.dim : kind === "plan" ? theme.plan : theme.tool;
  return status === "pending" ? { icon: "○", color } : { icon: "•", color };
}

function blockContentLines(content: TranscriptBlockContent): string[] {
  if (content.type === "text") return content.text.split("\n").filter(Boolean);
  if (content.type === "lines") return content.lines.map((line) => line.slice(0, TAIL_LINE_MAX_CHARS));
  if (content.type === "output") return content.lines.map((line) => line.slice(0, TAIL_LINE_MAX_CHARS));
  if (content.type === "code" || content.type === "command" || content.type === "diff") return [];
  const markOf = (status: string): string =>
    status === "completed" ? "☑" : status === "in_progress" ? "◐" : "☐";
  return content.entries.map((entry) => `${markOf(entry.status)} ${entry.content}`);
}
