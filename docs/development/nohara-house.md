# 野原家的小屋

**范围**　2026-11-24，独立微信小游戏目标 `nohara-house`。执行 `npm.cmd run build:target -- nohara-house` 后，首屏进入红屋顶住宅和院落的外观场景。 [App 入口](../../src/game/apps/nohara-house/main.ts) · [目标清单](../../scripts/targets.json)

**场景**　底部 HUD 可切换外观、客厅、厨房、和室、儿童房和浴室。室内以开放剖面展示家具与空间，房间布置为本应用的设计。空间采用 Three.js 程序化几何、卡通材质和深色轮廓。有效释放才触发切换，拖出或取消保留当前房间。场景退出后释放它的几何和材质。 [房间几何](../../src/game/apps/nohara-house/three/houseModels.ts) · [相机与场景](../../src/game/apps/nohara-house/three/houseScene.ts) · [Pixi HUD](../../src/game/apps/nohara-house/hud/houseHud.ts)

**资源**　`media/nohara-house/packaged/ui/labels.png` 随主包发布，由共享资源加载器读取。中文文案在 `rooms.ts` 维护，修改后在带 Pillow 和微软雅黑粗体的 Windows 环境执行 `python scripts/build-nohara-labels.py`，同步生成 PNG 和字形索引。房间模型由代码创建。 [文案](../../src/game/apps/nohara-house/rooms.ts) · [图集生成脚本](../../scripts/build-nohara-labels.py)

**首版验证**　独立 WebGL1 构建输出 1,050,532 字节 JS 和 21,510 字节 HUD 图集。全仓类型检查和 27 项自动测试通过。本地软件 WebGL 在 390 × 820 视口分别绘制了六个场景，并加载主包字形图集。 [房间切换回归](../../tests/nohara-house.test.cjs)

## 拖动视角与主角

**改动**　从场景区单指拖动可改变相机的水平角度和俯仰。外观支持水平环绕，室内限制在剖面的开放侧。按住底部房间按钮的手势由 HUD 接管，有效松手才切换。六个场景各放置一份由 Three.js 基本几何搭建的小新模型，沿用场景的卡通材质和轮廓。房间退出时释放角色与场景的几何、材质。 [相机与触摸](../../src/game/apps/nohara-house/three/houseScene.ts) · [房间与角色建模](../../src/game/apps/nohara-house/three/houseModels.ts) · [电视朝日角色参考](https://www.tv-asahi.co.jp/shinchan/character/)

**验证**　`npm.cmd run build:target -- nohara-house`、全仓类型检查与 28 项自动测试通过。回归覆盖绕转、室内限位、触摸取消、房间切换和角色资源释放。本地 WebGL 将触摸事件送入实际构建产物，验证外观在拖动前后从不同角度绘制。已在微信开发者工具 Stable 1.06.2402030 的 iPhone 5 模拟器看到新版外观、浴室和厨房画面及小新模型。当前工作区产物为 `nohara-house`，微信预览和真机待验。 [自动回归](../../tests/nohara-house.test.cjs)
