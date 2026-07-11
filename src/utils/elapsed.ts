/**
 * 运行时长展示：mm:ss，满一小时升 h:mm:ss。
 * 负数按 0 处理（消费方时钟回拨/跨机器 startedAt 的兜底，不值得让 UI 显示 -00:01）。
 */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const mmss = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

/** RunStatusItem → 单行文案的 dim 尾段（author 之后的部分）；纯函数便于单测 */
export function runStatusTail(item: { label: string; startedAt?: number; hint?: string }, now: number): string {
  const parts = [item.label];
  if (item.startedAt !== undefined) parts.push(formatElapsed(now - item.startedAt));
  if (item.hint) parts.push(item.hint);
  return parts.join(" · ");
}
