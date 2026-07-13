import {
  getTreeSitterClient,
  pathToFiletype,
  SyntaxStyle,
  treeSitterToStyledText,
  type MouseEvent,
  type StyledText,
} from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { defaultTheme, type Theme, type TranscriptBlockContent, type TranscriptItem } from "../types/index.ts";
import { clipLines, defaultClipPolicy, hiddenHint, type ClipBudget, type ClipPolicy } from "../utils/clip.ts";
import { diffRows, diffStats, type DiffView } from "../utils/diff.ts";
import { useTokenSelectionOnDoubleClick } from "./token-selection.ts";

export interface TranscriptProps {
  /** 顶部说明文字（产品名、快捷键提示等），dim 展示 */
  header?: string;
  items: TranscriptItem[];
  /** thought 消息是否渲染（对应 show-thoughts 配置） */
  showThoughts?: boolean;
  theme?: Theme;
  /** 高度预算策略；缺省 defaultClipPolicy。Ctrl+O 展开态由 Transcript 内部管理，策略无需感知 */
  clipPolicy?: ClipPolicy;
  /** 逐条自定义渲染；返回 undefined 时走默认渲染。自定义渲染自行负责高度预算（可复用 utils/clip.ts） */
  renderItem?: (item: TranscriptItem) => ReactNode | undefined;
}

/** 渲染期的裁剪上下文：策略 + 展开态 + 宽度，一次算好贯穿所有 item */
interface ClipContext {
  policy: ClipPolicy;
  expanded: boolean;
  wrapWidth: number;
  /** 终端总列数（diff 的 unified/split 视图切换用原始宽度判断，不用扣除缩进的 wrapWidth） */
  termWidth: number;
}

/** 裁剪后的一行展示：hint=省略提示行；dim=弱化色（output 段与命令源码在视觉上区分） */
interface ContentLine {
  text: string;
  hint: boolean;
  dim: boolean;
}

/** 对话时间线：滚动区 + 消息/工具/计划的默认渲染。粘底滚动，流式期间自动跟随；Ctrl+O 展开/收起被折叠的 block 内容。 */
export function Transcript(props: TranscriptProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const syntaxStyle = useMemo(() => syntaxStyleFor(theme), [theme]);
  const authorWidth = Math.max(
    0,
    ...props.items.filter((item) => item.type === "message").map((item) => messageAuthor(item).length),
  );
  const selectTokenOnDoubleClick = useTokenSelectionOnDoubleClick();
  // 折叠是展示层关心的事（不需要理解 agent 在干什么），所以展开态自持在 Transcript，
  // 不进 ChatProtocol；键位也注册在这里，让高度预算特性对 ChatShell 完全透明。
  const [expanded, setExpanded] = useState(false);
  useKeyboard((key) => {
    if (key.ctrl && key.name === "o") {
      key.preventDefault();
      setExpanded((value) => !value);
    }
  });
  const { width: termWidth } = useTerminalDimensions();
  const clip: ClipContext = {
    policy: props.clipPolicy ?? defaultClipPolicy,
    expanded,
    // scrollbox 左右 padding 2 + 内容缩进 4 + 1 列余量（滚动条/宽度度量误差兜底）。
    // 估小只是行提前折断；估大由 opentui 兜底 wrap（多占 1 行），都不破坏预算量级。
    wrapWidth: Math.max(16, termWidth - 7),
    termWidth,
  };
  return (
    <scrollbox style={{ flexGrow: 1, paddingLeft: 1, paddingRight: 1 }} stickyScroll stickyStart="bottom" focused={false}>
      {props.header ? <text fg={theme.dim} selectable>{`${props.header}\n`}</text> : null}
      {props.items.map((item) => {
        const custom = props.renderItem?.(item);
        if (custom !== undefined) return custom;
        return renderDefault(
          item,
          theme,
          syntaxStyle,
          props.showThoughts ?? true,
          clip,
          authorWidth,
          selectTokenOnDoubleClick,
        );
      })}
    </scrollbox>
  );
}

function renderDefault(
  item: TranscriptItem,
  theme: Theme,
  syntaxStyle: SyntaxStyle,
  showThoughts: boolean,
  clip: ClipContext,
  authorWidth: number,
  onPlainTextMouseDown: (event: MouseEvent) => void,
): ReactNode {
  if (item.type === "message") {
    const author = messageAuthor(item);
    const color =
      item.role === "user" ? theme.user : (theme.agentColorFor?.(author) ?? theme.agent);
    return (
      <box key={item.id} style={{ flexDirection: "row", marginTop: 1, width: "100%" }}>
        <text fg={color} style={{ width: authorWidth + 3, flexShrink: 0 }} selectable>
          {`${author.padEnd(authorWidth + 1)}> `}
        </text>
        {item.format === "markdown" ? (
          <markdown
            content={item.text}
            syntaxStyle={syntaxStyle}
            streaming={item.streaming ?? false}
            style={{ flexGrow: 1, flexShrink: 1 }}
          />
        ) : (
          <text
            style={{ flexGrow: 1, flexShrink: 1 }}
            wrapMode="word"
            selectable
            onMouseDown={onPlainTextMouseDown}
          >
            {item.text}
          </text>
        )}
      </box>
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
          {blockTitle(item, theme)}
        </text>
        {contents.map((content, index) =>
          renderRichContent(item, content, `${item.id}:${index}`, theme, syntaxStyle, clip),
        )}
      </box>
    );
  }
  // 逐行 span：省略提示与 output 段用弱化色，同一 block 内混排不同类型时各保各色
  const content = contents.flatMap((piece) => clippedContentLines(item, piece, clip));
  const baseColor = item.kind === "thought" ? theme.dim : theme.tool;
  // Keep one text renderable mounted while a running block gains output. OpenTUI can
  // otherwise leave cells from the old two-row flex layout behind during reflow.
  return (
    <text key={item.id} style={{ marginTop: 1 }} selectable>
      <span fg={color}>{icon}</span>
      {blockTitle(item, theme)}
      {content.map((line, index) => (
        <span key={index} fg={line.hint || line.dim ? theme.dim : baseColor}>
          {`\n${index === 0 ? "  └ " : "    "}${line.text}`}
        </span>
      ))}
    </text>
  );
}

function messageAuthor(item: Extract<TranscriptItem, { type: "message" }>): string {
  return item.author ?? (item.role === "user" ? "you" : "agent");
}

/** block 标题：有 author 时渲染 `author · title`，author 复用消息侧的 agentColorFor 着色协议 */
function blockTitle(item: Extract<TranscriptItem, { type: "block" }>, theme: Theme): ReactNode {
  if (!item.author) return <strong>{` ${item.title}`}</strong>;
  const authorColor = theme.agentColorFor?.(item.author) ?? theme.agent;
  return (
    <>
      <span fg={authorColor}>{` ${item.author}`}</span>
      <span fg={theme.dim}>{" · "}</span>
      <strong>{item.title}</strong>
    </>
  );
}

/**
 * 内容段 → 预算内的展示行。裁剪产出的是已按 wrapWidth 折行的视觉行（不会被 opentui
 * 二次 wrap，高度由构造保证）；未裁剪（预算内/展开/策略豁免）时保留 logical lines，
 * 交给 opentui word wrap，维持原有观感。
 */
function clippedContentLines(
  item: TranscriptItem & { type: "block" },
  content: TranscriptBlockContent,
  clip: ClipContext,
): ContentLine[] {
  const lines = blockContentLines(content);
  if (lines.length === 0) return [];
  const dim = content.type === "output";
  const budget = clip.expanded ? null : clip.policy(item, content);
  if (!budget) return lines.map((text) => ({ text, hint: false, dim }));
  const { head, tail, hiddenRows } = clipLines(lines, clip.wrapWidth, budget);
  if (hiddenRows === 0) return head.map((text) => ({ text, hint: false, dim }));
  return [
    ...head.map((text) => ({ text, hint: false, dim })),
    { text: hiddenHint(hiddenRows), hint: true, dim },
    ...tail.map((text) => ({ text, hint: false, dim })),
  ];
}

function renderRichContent(
  item: TranscriptItem & { type: "block" },
  content: TranscriptBlockContent,
  key: string,
  theme: Theme,
  syntaxStyle: SyntaxStyle,
  clip: ClipContext,
): ReactNode {
  const budget = clip.expanded ? null : clip.policy(item, content);
  if (content.type === "code" || content.type === "command") {
    const code = content.type === "command" ? content.command : content.code;
    const language = content.type === "command" ? (content.language ?? "bash") : content.language;
    const codeLines = code.replace(/\n$/, "").split("\n");
    // code/command 走 logical line 裁剪（预留 1 行提示）：patch 不能掐、代码可以——
    // tree-sitter 对截断源码降级为 fallback 配色，可接受。clipped 时禁二次 wrap 保住预算。
    const clipped = budget !== null && codeLines.length > budget.maxRows;
    const shown = clipped ? codeLines.slice(0, budget.maxRows - 1).join("\n") : code;
    return (
      <box key={key} style={{ flexDirection: "column" }}>
        <HighlightedCode
          code={shown}
          language={language}
          fallbackColor={theme.tool}
          syntaxStyle={syntaxStyle}
          wrap={!clipped}
        />
        {clipped ? (
          <text fg={theme.dim} style={{ marginLeft: 4 }} selectable>
            {hiddenHint(codeLines.length - (budget.maxRows - 1))}
          </text>
        ) : null}
      </box>
    );
  }
  if (content.type === "diff") {
    return renderDiffContent(content, key, theme, syntaxStyle, clip, budget);
  }
  const lines = clippedContentLines(item, content, clip);
  return lines.length > 0 ? (
    <text key={key} style={{ marginLeft: 4 }} selectable>
      {lines.map((line, index) => (
        <span key={index} fg={line.hint || line.dim ? theme.dim : theme.tool}>
          {`${index === 0 ? "" : "\n"}${line.text}`}
        </span>
      ))}
    </text>
  ) : null;
}

/** split 视图的启用门槛（终端总列数）：对齐 OpenCode 的宽屏切换点 */
const SPLIT_MIN_TERM_WIDTH = 120;

/**
 * diff 内容块：op 决定渲染待遇。
 * - modify/move：对比视图（行号 + 宽屏 split），move 额外有路径标题；
 * - add：新文件预览——恒 unified + 透明背景，只留行号与 + 号，不伪装成修改；
 * - delete：一行摘要，Ctrl+O 才展开完整删除内容（红墙默认没有判读价值）。
 */
function renderDiffContent(
  content: Extract<TranscriptBlockContent, { type: "diff" }>,
  key: string,
  theme: Theme,
  syntaxStyle: SyntaxStyle,
  clip: ClipContext,
  budget: ClipBudget | null,
): ReactNode {
  const stats = content.patch ? diffStats(content.patch) : null;
  const header = diffHeaderText(content, stats);
  const headerColor =
    content.op === "add" ? theme.success : content.op === "delete" ? theme.error : theme.tool;
  const children: ReactNode[] = [
    <text key={`${key}:h`} fg={headerColor} selectable>
      {header}
    </text>,
  ];

  const collapsedDelete = content.op === "delete" && !clip.expanded;
  const patch = collapsedDelete ? undefined : content.patch;
  if (!patch) {
    if (collapsedDelete && stats) {
      children.push(
        <text key={`${key}:hint`} fg={theme.dim} selectable>
          {hiddenHint(stats.removed)}
        </text>,
      );
    }
  } else {
    const view: DiffView =
      content.op !== "add" && clip.termWidth >= SPLIT_MIN_TERM_WIDTH ? "split" : "unified";
    const totalRows = diffRows(patch, view);
    // diff 是有语法结构的，掐内容会裁出非法 patch——用固定高度 box + overflow hidden
    // 做视口封顶（看头部），diff renderable 自身保持全量高度。
    const clipped = budget !== null && totalRows > budget.maxRows;
    const shownRows = clipped ? budget.maxRows - 1 : totalRows;
    const diffNode = (
      <diff
        key={`${key}:patch`}
        diff={patch}
        view={view}
        filetype={pathToFiletype(content.path)}
        syntaxStyle={syntaxStyle}
        showLineNumbers
        wrapMode="none"
        addedBg={content.op === "add" ? "transparent" : (theme.diffAddedBg ?? "transparent")}
        removedBg={theme.diffRemovedBg ?? "transparent"}
        contextBg="transparent"
        addedSignColor={theme.success}
        removedSignColor={theme.error}
        style={{ width: "100%", height: totalRows }}
      />
    );
    if (clipped) {
      children.push(
        <box key={`${key}:vp`} style={{ height: shownRows, overflow: "hidden", flexDirection: "column" }}>
          {diffNode}
        </box>,
        <text key={`${key}:hint`} fg={theme.dim} selectable>
          {hiddenHint(totalRows - shownRows)}
        </text>,
      );
    } else {
      children.push(diffNode);
    }
  }

  return (
    <box key={key} style={{ flexDirection: "column", marginLeft: 4 }}>
      {children}
    </box>
  );
}

/** 每个 diff 块自我标识"哪个文件、什么操作"——多文件改动不依赖 block 标题辨别归属 */
function diffHeaderText(
  content: Extract<TranscriptBlockContent, { type: "diff" }>,
  stats: { added: number; removed: number } | null,
): string {
  switch (content.op) {
    case "add":
      return `+ ${content.path}${stats ? ` (+${stats.added})` : ""}`;
    case "delete":
      return `- ${content.path}${stats ? ` (-${stats.removed})` : ""}`;
    case "move":
      return `${content.oldPath ?? "?"} → ${content.path}`;
    default:
      return `± ${content.path}${stats ? ` (+${stats.added} -${stats.removed})` : ""}`;
  }
}

function HighlightedCode(props: {
  code: string;
  language: string;
  fallbackColor: string;
  syntaxStyle: SyntaxStyle;
  /** false 时禁 word wrap（裁剪态：超宽行右缘截断，保证视觉行数 == 预算行数） */
  wrap?: boolean;
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
  return (
    <text
      content={content}
      fg={props.fallbackColor}
      wrapMode={props.wrap === false ? "none" : undefined}
      style={{ marginLeft: 4 }}
      selectable
    />
  );
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
  // declined ≠ failed：操作没跑就被拒了，用"禁止"符号 + warning 色，不伪装成执行出错
  if (status === "declined") return { icon: "⊘", color: theme.warning };
  if (status === "completed") return { icon: "✓", color: theme.success };
  const color = kind === "thought" ? theme.dim : kind === "plan" ? theme.plan : theme.tool;
  return status === "pending" ? { icon: "○", color } : { icon: "•", color };
}

// 高度预算由 clip 层负责，这里只做"内容 → logical lines"的展开，不再截断
function blockContentLines(content: TranscriptBlockContent): string[] {
  if (content.type === "text") return content.text.split("\n").filter(Boolean);
  if (content.type === "lines" || content.type === "output") return content.lines;
  if (content.type === "code" || content.type === "command" || content.type === "diff") return [];
  const markOf = (status: string): string =>
    status === "completed" ? "[✓]" : status === "in_progress" ? "[•]" : "[ ]";
  return content.entries.map((entry) => `${markOf(entry.status)} ${entry.content}`);
}
