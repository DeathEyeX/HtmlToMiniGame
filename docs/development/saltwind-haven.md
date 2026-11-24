# 盐风庇护所开发记录

**范围**　2026-11-24，独立 WebGL1 目标 `saltwind-haven`。首屏从斜上方展示整座海上聚落。App 通过 `startGame` 使用现有上屏 Canvas、帧循环、手势分流和 Pixi HUD。 [入口](../../src/game/apps/saltwind-haven/main.ts) · [目标清单](../../scripts/targets.json)

**场景**　生活住宅、观察塔、种植区、加工区、淡水区、捕鱼区和能源区各有独立的建筑节点。主区木筏加三处辅助浮台由不同高度的栈桥连接，浮桶、轮胎和连接件可从斜侧面观察。模型采用原创倒角构件、轮廓几何、程序木纹和分材质合批。住宅保留开放起居层，水泵和过滤罐通过管道连接，木船由随两端更新的缆绳系在码头。 [浮台和栈桥](../../src/game/apps/saltwind-haven/three/decks.ts) · [住宅和观察塔](../../src/game/apps/saltwind-haven/three/shelter.ts) · [生产区](../../src/game/apps/saltwind-haven/three/production.ts) · [水边及能源区](../../src/game/apps/saltwind-haven/three/shoreline.ts)

**海面与动画**　Shader 和独立船只、浮标共用四组波相位。水面颜色受法线扰动、菲涅耳反射和疏密不同的太阳高光影响。固定甲板水线在启动时烘焙，船与漂浮物的水线逐帧更新，泡沫纹理持续运动。整座基地轻微升沉、横摇和纵摇，风机、晾晒布、炉火、烟雾、海鸟和四名作业人员持续动画。静态零件在模块内按材质合批，摇摆中的主阴影按场景时间低频刷新。 [海洋 Shader](../../src/game/apps/saltwind-haven/three/ocean.ts) · [环境动画](../../src/game/apps/saltwind-haven/three/life.ts) · [场景装配](../../src/game/apps/saltwind-haven/three/scene.ts)

**操作**　点按底部功能区可聚焦，点按「全景」复位。拖动环绕，双指或 `+`、`−` 调整距离。点按「净屏」后，右上角提示短暂出现并自动消失，点按同一位置恢复 HUD。竖屏全景按横向跨度取景，以完整保留基地轮廓。 [镜头](../../src/game/apps/saltwind-haven/three/camera.ts) · [HUD](../../src/game/apps/saltwind-haven/hud/havenHud.ts)

**资源与扩展**　主包素材为 `media/saltwind-haven/packaged/ui/glyphs.png`。修改 HUD 文案后用 `python scripts/build-saltwind-glyphs.py` 重建字形索引和图集。场景几何和材质由 App 本地生成。`content.ts` 中的 `zones` 配置浮台位置、旋转、尺寸和聚焦点，`buildings` 提供独立的建筑占地、偏移、旋转和缩放。各建造函数从甲板原点起模，可替换为对应尺度的美术模型。后续增建平台时可在 `decks.ts` 的 `passage` 中接入新栈桥，再将端点作为建造或路线节点。 [配置入口](../../src/game/apps/saltwind-haven/content.ts) · [字形脚本](../../scripts/build-saltwind-glyphs.py)

**验证**　`npm.cmd run dev:web -- saltwind-haven` 联调了浮台、主体建筑、功能区、环境动画和最终构图。在 1440 × 900 横屏和 390 × 844 竖屏复核了全景、区域聚焦、拖动、双指缩放、净屏及恢复。最终 Edge 会话控制台无错误或警告。1440 × 900 的短时软件渲染采样平均约 148 次绘制调用和 14 万个三角形每帧，包含阴影与 HUD，软件采样约 4.5 FPS。`npm.cmd run typecheck` 通过。`npm.cmd test` 的 34 项用例中 33 项通过，目标隔离用例通过，`nohara-house` 的小新模型 `isMesh` 断言仍为已知失败项。 [既有失败记录](tidal-harbor.md) · [对应断言](../../tests/nohara-house.test.cjs#L50)

**交接**　`npm.cmd run build:target -- saltwind-haven` 已通过，当前 `dist/game.bundle.js` 为该目标的默认 WebGL1 构建，主包包含字形图集。微信开发者工具从工程根目录编译，首屏可依次检查全景、功能区聚焦、单指环绕、双指缩放和净屏恢复。模拟器、微信预览、真机触摸和真机帧率待开发者验收。 [验收分工](../AGENT_WORKFLOW.md#5-微信构建与开发者验收)

## 海鸥翅膀闪烁

内翼和深色翼尖的平面多边形原先有重叠，扇动时两种颜色在相同深度上争夺显示。两段现在沿共用边接合。几何回归检查在修复前复现了同一翼面被两种颜色覆盖，修复后检查了四只海鸥的八片翅膀，正反面均无重叠，扇动姿态随时间更新。 [翅膀几何与动画](../../src/game/apps/saltwind-haven/three/life.ts)

WebGL1 网页预览的横竖屏均完成渲染，浏览器控制台无错误或警告。类型检查通过，全仓回归 33/34 通过，唯一失败为此前记录的 `nohara-house` 模型断言。已重新构建 `saltwind-haven` 微信产物，模拟器和真机待验。
