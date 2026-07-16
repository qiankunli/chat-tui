import type { ReactNode } from "react";

import { defaultTheme, type StatusMessage, type Theme } from "../types/index.ts";

export interface StatusLineProps {
  /** 瞬时状态（错误/提示）；存在时展示在 footer 上方 */
  status: StatusMessage | null;
  /** 常驻信息行（usage、队列长度、cwd 等） */
  fallback: string;
  theme?: Theme;
}

/** 底部状态栏：footer 常驻，瞬时 status 有内容时在其上方另占一行。 */
export function StatusLine(props: StatusLineProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  return (
    <box style={{ flexDirection: "column", flexShrink: 0 }}>
      {props.status && (
        <box style={{ height: 1, flexShrink: 0 }}>
          <text fg={props.status.tone === "error" ? theme.error : theme.accent} selectable>
            {props.status.text}
          </text>
        </box>
      )}
      <box style={{ height: 1, flexShrink: 0 }}>
        <text fg={theme.dim} selectable>{props.fallback}</text>
      </box>
    </box>
  );
}
