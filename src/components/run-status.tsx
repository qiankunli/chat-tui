import { useEffect, useState, type ReactNode } from "react";

import { defaultTheme, type RunStatusItem, type Theme } from "../types/index.ts";
import { runStatusTail } from "../utils/elapsed.ts";

export interface RunStatusProps {
  items: RunStatusItem[];
  theme?: Theme;
}

/**
 * Agent Status 区（贴 composer 顶部，由 Composer 组合渲染）："现在时"信息，不随历史滚动。
 * author 着色沿用 theme.agentColorFor，与 transcript 的作者名同源同色；空列表不占高度。
 * 外层间距归 Composer 的分组容器，这里不带 margin。
 */
export function RunStatus(props: RunStatusProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const ticking = props.items.some((item) => item.startedAt !== undefined);
  // elapsed 跳秒是纯展示状态，自持在组件里——消费方只在状态变化时发快照，无需为跳秒重发
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => clearInterval(timer);
  }, [ticking]);
  if (props.items.length === 0) return null;
  return (
    <box style={{ flexDirection: "column", flexShrink: 0, paddingLeft: 1, paddingRight: 1 }}>
      {props.items.map((item) => {
        const tail = runStatusTail(item, Date.now());
        return (
          <box key={item.id} style={{ flexDirection: "row" }}>
            {item.author ? (
              <text fg={theme.agentColorFor?.(item.author) ?? theme.agent} style={{ flexShrink: 0 }}>
                {`• ${item.author} `}
              </text>
            ) : null}
            <text fg={theme.dim}>{item.author ? `· ${tail}` : `• ${tail}`}</text>
          </box>
        );
      })}
    </box>
  );
}
