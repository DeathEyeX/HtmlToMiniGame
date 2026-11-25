# 赛博生物展厅

2026-11-24 新建独立 App `cyber-beast`。首屏展示四足赛博怪兽「裂隙猎犬」，Three.js 在启动时生成装甲、脊刺、义体线路、分节尾巴和带光带的旋转展台。兽首、尾巴和胸口核心有待机动画。模型随台面转动，拖动场景可环绕观察。底部 HUD 可暂停或启动转台，并复位相机和展台朝向。 [App 入口](../../src/game/apps/cyber-beast/main.ts) · [怪兽模型](../../src/game/apps/cyber-beast/three/beast.ts) · [展台场景](../../src/game/apps/cyber-beast/three/exhibitScene.ts)

几何与材质由 App 创建。主包内含中文 HUD 图集，生成脚本使用 Pillow 和 Windows 字体。更新图集文案时执行 `python scripts/build-cyber-beast-labels.py`。 [图集生成脚本](../../scripts/build-cyber-beast-labels.py) · [目标清单](../../scripts/targets.json)

## 首版验证

- `npm.cmd run dev:web -- cyber-beast` 已在 Edge 的 1380 × 820 和 390 × 820 视口联调。Three.js 和 Pixi HUD 成功初始化，确认横竖屏首屏、拖动环绕、暂停、恢复与复位。浏览器控制台无错误。
- 独立 App 类型检查和 `npm.cmd run build:target -- cyber-beast` 通过。工作区当前是该目标的 WebGL1 主包构建，包含 `dist/game.bundle.js` 和 `dist/resources/packaged/cyber-beast/ui/labels.png`。
- `npm.cmd run typecheck` 报告开发中的 `mad-water-haven` 有参数类型错误。`npm.cmd test` 共 34 项，33 项通过。全目标打包用例遇到 `mad-water-haven` 缺少主包素材目录。
- 微信开发者工具、微信预览和真机待验。打开工程后编译，检查首屏兽首和尾尖是否完整、单指拖动是否顺畅，以及两个展台按钮是否生效。

## 参考图低模与原地踏步

2026-11-24 新增默认展品「霓虹异骸」。躯干和脸部用自定义三角网格塑形，白发与破损衣摆用带折面的几何条带造型，机械半身、霓虹线缆和爪尖分件装配。按每个 Mesh 实例的几何索引统计，新角色有 5,220 个三角面，四足猎犬有 8,114 个三角面，统计范围仅为展品。 [双足模型](../../src/game/apps/cyber-beast/three/wraith.ts) · [四足模型](../../src/game/apps/cyber-beast/three/beast.ts)

两只怪兽都用同一个双段腿部求解逻辑，腿以不同相位交替摆动，支撑脚约束在台面高度，角色根节点留在展台中心。HUD 可分别控制踏步和转台，并切换展品。切换后复位展品的观察角度。 [踏步求解](../../src/game/apps/cyber-beast/three/walkRig.ts) · [展厅 HUD](../../src/game/apps/cyber-beast/hud/exhibitHud.ts)

- Edge 的 1380 × 820、390 × 820 和 320 × 680 视口验证了模型展示、踏步开关、模型切换、拖动环绕与复位。浏览器控制台无错误。
- 全仓类型检查、36 项自动测试和 `npm.cmd run build:target -- cyber-beast` 通过。回归测试覆盖双足和四足的支撑脚接触、轮流抬脚和停步落地。当前构建为 `cyber-beast` 的 WebGL1 主包，主包资源为更新后的 HUD 图集。 [踏步回归](../../tests/cyber-beast.test.cjs)
- 微信开发者工具和真机待验。验证首屏双足模型、踏步停止时双脚落地，以及切换到四足版本后的踏步。
