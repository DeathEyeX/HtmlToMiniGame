# 前线前哨站

**范围**　2026-11-25，将用户提供的单页原型接为 WebGL1 独立目标 `war-outpost`。首屏为 A-03 前哨站的斜前方视角，支持另外四个视角预设、自动旋转和线框。 [App 入口](../../src/game/apps/war-outpost/main.ts)

**场景与资源**　复用 `startGame` 管理上屏 Canvas、帧循环和触摸分流。程序生成的几何与 Canvas 贴图随场景释放，颜色贴图使用 r133 的 `sRGBEncoding`。静态灯光和几何共用首帧阴影。中文 HUD 采用主包图集，修改文案时用 Pillow 和 Windows 微软雅黑生成。 [场景](../../src/game/apps/war-outpost/three/outpostScene.ts) · [图集生成](../../scripts/build-outpost-labels.py)

**输入**　单指拖动旋转，双指缩放和平移，桌面可拖动和使用缩放按钮。HUD 随视口和微信安全区调整。按下按钮后移出再松开不会触发按钮。 [HUD](../../src/game/apps/war-outpost/hud/outpostHud.ts)

**验收命令**

~~~powershell
npm.cmd run dev:web -- war-outpost
npm.cmd run test:browser -- war-outpost --hud --device compact --device phone --device desktop
npm.cmd run build:web -- war-outpost
npm.cmd run build:target -- war-outpost --isolated
~~~

**本地结果**　三个视口首帧和九个 HUD 命中区通过无头 Edge 检查。浏览器交互验证覆盖五个预设、自动旋转、线框、放大和缩小、移出按钮后释放、单指拖动、双指缩放和平移。静态网页和独立微信产物分别在 `.build/releases/war-outpost/web/` 和 `.build/releases/war-outpost/wechat/`，中文 HUD 在默认主包中。

**微信待验**　开发者在微信开发者工具导入独立产物，确认首屏、菜单安全区、五个视角、旋转、线框和缩放按钮，再在真机核对双指手势、3D 招牌文字和纹理显示。模拟器、预览和真机结果待补。
