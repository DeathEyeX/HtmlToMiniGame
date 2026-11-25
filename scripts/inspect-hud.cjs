function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;
}

function inspectHud(controls, viewport, capsule) {
  const ids = new Set();
  const issues = [];
  const measurable = [];
  for (const control of controls) {
    const { id, x, y, width, height } = control;
    const add = (code, severity, message, other) => issues.push({ code, severity, id, message, ...(other && { other }) });
    if (ids.has(id)) add('duplicate-id', 'error', '触摸控件 ID 重复。');
    ids.add(id);
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      add('invalid-bounds', 'error', '触摸区域必须有有效坐标和尺寸。');
      continue;
    }
    if (x < -0.01 || y < -0.01 || x + width > viewport.width + 0.01 || y + height > viewport.height + 0.01) {
      add('outside-viewport', 'error', '触摸区域超出视口。');
    }
    if (capsule && overlaps(control, capsule)) add('capsule-overlap', 'error', '触摸区域与模拟的微信胶囊重叠。');
    if (Math.min(width, height) < 32) add('small-target', 'warning', '触摸区域的短边小于 32 CSS 像素。');
    for (const other of measurable) {
      const intentional = control.overlapGroup && control.overlapGroup === other.overlapGroup;
      if (!intentional && overlaps(control, other)) add('target-overlap', 'error', '触摸区域与另一控件重叠。', other.id);
    }
    measurable.push(control);
  }
  return issues;
}

module.exports = { inspectHud };
