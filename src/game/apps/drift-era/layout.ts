export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function driftLayout(width: number, height: number, immersive: boolean) {
  const info = wx.getSystemInfoSync();
  const safeTop = info.safeArea?.top ?? 0;
  const safeBottom = info.safeArea ? Math.max(0, info.screenHeight - info.safeArea.bottom) : 0;
  const topInset = Math.max(safeTop, wx.getMenuButtonBoundingClientRect?.()?.bottom ?? 0);
  const compact = width < 760 || width / height < 1.2;
  const designWidth = compact ? 390 : 1180;
  const designHeight = compact ? 728 : 680;
  const scale = Math.min(1.25, width / designWidth, Math.max(1, height - topInset - safeBottom) / designHeight);
  const left = (width - designWidth * scale) / 2;
  const top = topInset + (height - topInset - safeBottom - designHeight * scale) / 2;
  const world: Rect = immersive
    ? { x: 12, y: 56, width: designWidth - 24, height: designHeight - 102 }
    : compact
      ? { x: 13, y: 176, width: 364, height: 198 }
      : { x: 17, y: 173, width: 866, height: 373 };

  return { width, height, designWidth, designHeight, scale, left, top, compact, immersive, world };
}

export type DriftLayout = ReturnType<typeof driftLayout>;
