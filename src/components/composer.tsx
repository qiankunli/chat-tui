import type { TextareaOptions, TextareaRenderable } from "@opentui/core";
import { useImperativeHandle, useRef, type ReactNode, type Ref } from "react";

import { defaultTheme, type RunStatusItem, type Theme } from "../types/index.ts";
import { RunStatus } from "./run-status.tsx";

// 对齐 chat CLI 习惯：Enter 发送；Shift+Enter / Option+Enter 换行。
// Shift+Enter 需要终端支持 kitty keyboard 协议才能与 Enter 区分；
// Ctrl+J 是任何终端都可用的换行兜底（走 textarea 默认的 linefeed→newline 绑定）。
export const COMPOSER_KEY_BINDINGS: NonNullable<TextareaOptions["keyBindings"]> = [
  { name: "return", action: "submit" },
  { name: "kpenter", action: "submit" },
  { name: "return", shift: true, action: "newline" },
  { name: "kpenter", shift: true, action: "newline" },
  { name: "return", meta: true, action: "newline" },
  { name: "kpenter", meta: true, action: "newline" },
];

export interface ComposerHandle {
  /** 覆写输入内容并把光标移到末尾（用于队列召回、补全等） */
  setText(text: string): void;
  clear(): void;
  focus(): void;
}

export interface ComposerProps {
  ref?: Ref<ComposerHandle>;
  /** 边框标题；Agent Status 已承载输入目标信息时通常不再需要 */
  title?: string;
  /**
   * Agent Status 区：贴输入框顶部的"现在时"状态行。
   * 挂在 Composer 上（而非独立层）：状态描述的是输入目标的当下，随输入框固定在底部。
   */
  status?: RunStatusItem[];
  placeholder?: string;
  focused: boolean;
  /** 高亮边框表达"正在跑"（borderActive） */
  busy?: boolean;
  theme?: Theme;
  keyBindings?: NonNullable<TextareaOptions["keyBindings"]>;
  onChange: (text: string) => void;
  onSubmit: (text: string) => void;
}

/** 输入区高度估算：显式换行时随内容长高，上限 maxLines 行（+2 是边框） */
export function composerHeightFor(draft: string, maxLines = 6): number {
  return Math.min(maxLines, draft.split("\n").length) + 2;
}

/**
 * 多行输入框。textarea 自持内部 buffer，消费方的 draft state 只是镜像
 * （供候选推导/按键分层用）——清空/覆写必须走 ComposerHandle，两边才能一致。
 */
export function Composer(props: ComposerProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const textarea = useRef<TextareaRenderable | null>(null);

  useImperativeHandle(props.ref, () => ({
    setText(text: string) {
      textarea.current?.setText(text);
      textarea.current?.gotoBufferEnd();
    },
    clear() {
      textarea.current?.setText("");
    },
    focus() {
      textarea.current?.focus();
    },
  }));

  return (
    // marginTop 归分组容器：Agent Status 行与输入框之间不留空行，视觉上"贴"在边框顶部
    <box style={{ width: "100%", flexShrink: 0, marginTop: 1, flexDirection: "column" }}>
      <RunStatus items={props.status ?? []} theme={theme} />
      <box
        title={props.title}
        border
        borderColor={props.busy ? theme.borderActive : theme.border}
        style={{ width: "100%", flexShrink: 0 }}
      >
        <textarea
          ref={textarea}
          focused={props.focused}
          placeholder={props.placeholder}
          wrapMode="word"
          minHeight={1}
          maxHeight={6}
          width="100%"
          cursorStyle={{ style: "line", blinking: true }}
          keyBindings={props.keyBindings ?? COMPOSER_KEY_BINDINGS}
          onContentChange={() => props.onChange(textarea.current?.plainText ?? "")}
          onSubmit={() => {
            // textarea 的 submit 事件不带值，从内部 buffer 读
            props.onSubmit(textarea.current?.plainText ?? "");
          }}
        />
      </box>
    </box>
  );
}
