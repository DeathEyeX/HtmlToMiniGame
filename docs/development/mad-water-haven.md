# 疯狂水世界风海上庇护所开发记录

**范围**　2026-11-24，独立 WebGL1 目标 `mad-water-haven`。首屏以约 44° 斜俯视展示整座海上基地，通过 `startGame` 复用上屏 Canvas、帧循环、触摸分流和 Pixi HUD。 [入口](../../src/game/apps/mad-water-haven/main.ts) · [目标清单](../../scripts/targets.json)

**场景结构**　中央三层住宅（开放起居层、带环绕露台的卧室层、顶层晒台与坡屋顶阁楼）作为视觉核心，观察塔高约 10 米拉开纵向轮廓，种植区、加工区、淡水区、能源区、捕鱼区各有独立模块节点，主浮台边缘再拼出错位小平台。所有模块从甲板原点起模，`content.ts` 的 `zones` 和 `buildings` 分别控制浮台位置与建筑占地、偏移、旋转和缩放；功能建筑与浮台解耦，可单独替换。 [场景装配](../../src/game/apps/mad-water-haven/three/scene.ts) · [住宅](../../src/game/apps/mad-water-haven/three/habitat.ts) · [观察塔](../../src/game/apps/mad-water-haven/three/lookout.ts) · [浮台与栈桥](../../src/game/apps/mad-water-haven/three/platforms.ts)

**水下避难所群**　住宅甲板下方通过升降井连接主承压舱，玻璃穹顶透出暖光；左右与前方三个侧舱由带加强环的连廊连接，再挂一个更深的设备舱。前侧观察舱伸出主浮台边缘，默认机位可透过水面看到它的穹顶，作为水下层的视觉线索。潜水镜头降到水面以下约 1.9 米，水面透明度、青绿色雾、背景色与水下层点光源同步切换，另有面向相机的加法光柱。 [水下城](../../src/game/apps/mad-water-haven/three/depths.ts) · [镜头](../../src/game/apps/mad-water-haven/three/camera.ts)

**海面与动画**　海面 Shader 与木船、浮标、漂流木共用四组波相位；水面按法线扰动、菲涅耳、太阳高光和平台水线距离场生成泡沫，外圈再叠一层宽而薄的浪。整座基地轻微升沉、横摇和纵摇，风机、皮带轮、炉火、烟雾、海鸟、六名作业人员、水下鱼群、气泡与旗帜持续动画；水下城外的舱体与海床植被保持固定相对位置。 [海洋](../../src/game/apps/mad-water-haven/three/ocean.ts) · [环境动画](../../src/game/apps/mad-water-haven/three/life.ts)

**材质与合批**　木质构件用倒角盒和按长轴生成的木纹 UV，波纹铁皮、帆布、塑料浮桶、锈蚀金属和玻璃各用独立材质；卡通三阶渐变保留暖色阴影。几何体按节点与材质合批，描边改为沿顶点法线外扩 2.2 厘米的背面壳，避免整体缩放把屋顶推出去遮住表面。 [建造器](../../src/game/apps/mad-water-haven/three/kit.ts) · [道具](../../src/game/apps/mad-water-haven/three/props.ts)

**操作**　点按底部功能区聚焦对应区域，点按「全景」复位。拖动环绕，双指或右侧 `+`、`−` 调整距离。点按「净屏」隐藏 HUD，右上角提示自动消失，点按同一位置恢复。小屏功能区为五列两行，避免三行按钮盖住基地。 [HUD](../../src/game/apps/mad-water-haven/hud/havenHud.ts)

**资源与扩展**　主包素材为 `media/mad-water-haven/packaged/ui/glyphs.png`。修改 HUD 文案后执行 `python scripts/build-mad-water-glyphs.py` 重建字形索引和图集；脚本只收集 `content.ts` 中的汉字。场景几何与材质全部由 App 本地生成，不依赖运行时资源分包。新增区域时同步更新 `zones`、`buildings` 和 `scene.ts` 的 `builders`。 [字形脚本](../../scripts/build-mad-water-glyphs.py)

**验证**　`npm.cmd run typecheck` 通过，`npm.cmd test` 36 项全部通过。`npm.cmd run build:target -- mad-water-haven` 通过，`dist/game.bundle.js` 为 WebGL1 构建，主包包含 `dist/resources/packaged/mad-water-haven/ui/glyphs.png`。`npm.cmd run dev:web -- mad-water-haven` 在 642 × 401 横屏和 390 × 844 竖屏联调首屏、七个地面区与「水下城」聚焦、拖动、缩放和净屏，浏览器控制台无错误或着色器警告。微信开发者工具、微信预览和真机触摸待开发者验收。 [验收分工](../AGENT_WORKFLOW.md#5-微信构建与开发者验收)
