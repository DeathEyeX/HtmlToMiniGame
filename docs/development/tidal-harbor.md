# 潮汐浮城开发记录

**范围**　2026-11-24，独立业务目标 `tidal-harbor`。首屏为三层海上庇护所，场景可旋转，并提供水线与海底的观察视角。 [入口](../../src/game/apps/tidal-harbor/main.ts) · [目标清单](../../scripts/targets.json)

**场景**　露天鱼档、泵组、灯塔、温室、吊臂、作业艇和三层甲板由 Three.js 生成。水线楼群延伸至海床，海底另设淹没街道、接驳车、珊瑚、海藻和游动鱼群。材质纹理与水面高光提供点阵细节，场景按框架默认上屏分辨率渲染。水下使用单独的雾色、光色和光柱，远处的水面剪影按水下能见度裁掉。 [庇护所](../../src/game/apps/tidal-harbor/three/harbor.ts) · [城区](../../src/game/apps/tidal-harbor/three/city.ts) · [海面与水下光效](../../src/game/apps/tidal-harbor/three/sea.ts)

**交互**　单指可连续环绕旋转并调俯仰，双指缩放。HUD 切换庇护所、水线和海底时在同一场景内移动镜头。点选庇护所区域后，巡查员沿楼梯和栈桥步行到对应站点。 [镜头](../../src/game/apps/tidal-harbor/three/camera.ts) · [路线](../../src/game/apps/tidal-harbor/content.ts) · [HUD](../../src/game/apps/tidal-harbor/hud/hud.ts)

**资源**　主包只有 `media/tidal-harbor/packaged/ui/glyphs.png`。修改文案后用 `python scripts/build-harbor-glyphs.py` 更新图集和字形索引。 [生成脚本](../../scripts/build-harbor-glyphs.py)

**验证**　类型检查和 `npm.cmd run build:target -- tidal-harbor` 通过。全仓 34 项测试中 33 项通过，新增的拖动取消、捏合缩放、潜入高度和三层路线检查全部通过。`nohara-house` 仍有已知模型断言失败。`dev:web` 验证桌面拖动转到庇护所另一侧、切换水线，以及 390 × 820 视口的区域聚焦、角色抵达温室和海底画面。浏览器控制台无错误或警告。 [自动回归](../../tests/tidal-harbor.test.cjs)

**交接**　当前微信产物为 `tidal-harbor` 的 WebGL1 默认构建。微信开发者工具和真机由开发者验收，重点核对单指环绕、双指缩放、三个视角切换和跨层通行。 [验收分工](../AGENT_WORKFLOW.md#5-微信构建与开发者验收)
