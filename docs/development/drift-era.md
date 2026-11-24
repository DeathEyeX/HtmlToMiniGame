# 漂流纪元开发记录

**范围**　2026-11-24，独立业务目标 `drift-era`，首屏为潮汐庇护所。源码由独立网页原型迁入，按微信小游戏框架装配。 [App 入口](../../src/game/apps/drift-era/main.ts) · [目标清单](../../scripts/targets.json)

**场景与交互**　Three.js 在框架管理的 WebGL1 上下文中生成三层甲板、海面和角色。场景先绘制到低分辨率纹理，再用最近邻采样上屏，Pixi HUD 使用设备分辨率。触摸地图、场景标记或区域卡片后，角色沿共用的楼梯节点和栈桥坐标通行。旅行中改目的地时，角色先抵达当前路段的落脚点。 [场景渲染](../../src/game/apps/drift-era/three/world.ts) · [路线](../../src/game/apps/drift-era/routes.ts) · [Pixi HUD](../../src/game/apps/drift-era/hud/driftHud.ts)

**联络任务**　回收打捞码头废料、在温室采集淡水，再登瞭望台修复电台并发信号。指挥舱和顶栏都可打开航行日志。浏览器保留 WASD、方向键和 E 快捷键。 [业务逻辑](../../src/game/apps/drift-era/game.ts) · [自动回归](../../tests/drift-era.test.cjs)

**打包资源**　`media/drift-era/packaged/` 包含 HUD 字形图集和微信互动音效。场景由代码生成。改 HUD 文案后运行 `python scripts/build-drift-assets.py` 更新图集和字形索引，生成脚本使用 Pillow 和微软雅黑。 [素材生成](../../scripts/build-drift-assets.py)

**验证**　`npm.cmd run typecheck` 和 `npm.cmd run build:target -- drift-era` 通过。`npm.cmd test` 共 31 项，30 项通过，含新 App 的跨层重新寻路和任务回归。既有 `nohara-house` 用例在单独运行时也未通过，失败点为小新模型的 `isMesh` 断言。`npm.cmd run dev:web -- drift-era` 验证了桌面全景、区域地图及 390 × 820 视口下的触摸通行、联络任务 3 / 3 和航行日志，浏览器控制台无错误或警告。

**交接**　当前本地微信产物为 `drift-era` 的 WebGL1 默认构建。微信开发者工具、预览和真机由开发者验收。模拟器可从打捞码头、温室到瞭望台走完任务，并验证音效开关。 [微信验收分工](../AGENT_WORKFLOW.md#5-微信构建与开发者验收)
