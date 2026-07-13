import type { ReactNode } from "react";

import { defaultTheme, type StatusMessage, type Theme } from "../types/index.ts";
import { useTokenSelectionOnDoubleClick } from "./token-selection.ts";

export interface StatusLineProps {
  /** 瞬时状态（错误/提示）；为空时展示 fallback */
  status: StatusMessage | null;
  /** 常驻信息行（usage、队列长度、cwd 等） */
  fallback: string;
  theme?: Theme;
}

/** 底部单行状态栏：status 优先，空闲时回落到常驻信息。 */
export function StatusLine(props: StatusLineProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const color = props.status?.tone === "error" ? theme.error : props.status ? theme.accent : theme.dim;
  const selectTokenOnDoubleClick = useTokenSelectionOnDoubleClick();
  return (
    <box style={{ height: 1 }}>
      <text fg={color} selectable onMouseDown={selectTokenOnDoubleClick}>
        {props.status?.text ?? props.fallback}
      </text>
    </box>
  );
}
