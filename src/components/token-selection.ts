import type { MouseEvent, TextRenderable } from "@opentui/core";
import { useRenderer } from "@opentui/react";
import { useRef } from "react";

import { tokenColumnRange, visualLineAt } from "./selection.ts";

/** 把 OpenTUI 双击产生的单字符选区扩成完整 token。 */
export function useTokenSelectionOnDoubleClick(): (event: MouseEvent) => void {
  const renderer = useRenderer();
  const lastClick = useRef<{ target: TextRenderable; x: number; y: number; at: number } | null>(null);

  return (event: MouseEvent): void => {
    const target = event.target as TextRenderable | null;
    if (!target || event.button !== 0) return;
    const now = Date.now();
    const previous = lastClick.current;
    const isDoubleClick =
      previous?.target === target && previous.y === event.y && Math.abs(previous.x - event.x) <= 1 && now - previous.at <= 350;
    lastClick.current = isDoubleClick ? null : { target, x: event.x, y: event.y, at: now };
    if (!isDoubleClick) return;

    const localY = event.y - target.y;
    const line = visualLineAt(target.plainText, target.width, localY);
    const range = line ? tokenColumnRange(line, event.x - target.x) : null;
    if (!range || range.end <= range.start) return;

    // OpenTUI 已在 mouse-down 建立单字符选区；第二击将它扩成 token，mouse-up 仍走
    // 框架原生 finishSelection，从而保留高亮并触发现有 OSC52 复制回调。
    renderer.startSelection(target, target.x + range.start, event.y);
    renderer.updateSelection(target, target.x + range.end, event.y);
  };
}
