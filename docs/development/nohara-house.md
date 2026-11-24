# 野原家的小屋

**范围**　2026-11-24，独立微信小游戏目标 `nohara-house`。执行 `npm.cmd run build:target -- nohara-house` 后，首屏进入红屋顶住宅和院落的外观场景。 [App 入口](../../src/game/apps/nohara-house/main.ts) · [目标清单](../../scripts/targets.json)

**场景**　底部 HUD 可切换外观、客厅、厨房、和室、儿童房和浴室。室内以开放剖面展示家具与空间，房间布置为本应用的设计。空间采用 Three.js 程序化几何、卡通材质和深色轮廓。有效释放才触发切换，拖出或取消保留当前房间。场景退出后释放它的几何和材质。 [房间几何](../../src/game/apps/nohara-house/three/houseModels.ts) · [相机与场景](../../src/game/apps/nohara-house/three/houseScene.ts) · [Pixi HUD](../../src/game/apps/nohara-house/hud/houseHud.ts)

**资源**　`media/nohara-house/packaged/ui/labels.png` 随主包发布，由共享资源加载器读取。中文文案在 `rooms.ts` 维护，修改后在带 Pillow 和微软雅黑粗体的 Windows 环境执行 `python scripts/build-nohara-labels.py`，同步生成 PNG 和字形索引。房间模型由代码创建。 [文案](../../src/game/apps/nohara-house/rooms.ts) · [图集生成脚本](../../scripts/build-nohara-labels.py)

**首版验证**　独立 WebGL1 构建输出 1,050,532 字节 JS 和 21,510 字节 HUD 图集。全仓类型检查和 27 项自动测试通过。本地软件 WebGL 在 390 × 820 视口分别绘制了六个场景，并加载主包字形图集。 [房间切换回归](../../tests/nohara-house.test.cjs)

## 拖动视角与主角

**改动**　从场景区单指拖动可改变相机的水平角度和俯仰。外观支持水平环绕，室内限制在剖面的开放侧。按住底部房间按钮的手势由 HUD 接管，有效松手才切换。六个场景各放置一份由 Three.js 基本几何搭建的小新模型，沿用场景的卡通材质和轮廓。房间退出时释放角色与场景的几何、材质。 [相机与触摸](../../src/game/apps/nohara-house/three/houseScene.ts) · [房间与角色建模](../../src/game/apps/nohara-house/three/houseModels.ts) · [电视朝日角色参考](https://www.tv-asahi.co.jp/shinchan/character/)

**验证**　`npm.cmd run build:target -- nohara-house`、全仓类型检查与 28 项自动测试通过。回归覆盖绕转、室内限位、触摸取消、房间切换和角色资源释放。本地 WebGL 将触摸事件送入实际构建产物，验证外观在拖动前后从不同角度绘制。已在微信开发者工具 Stable 1.06.2402030 的 iPhone 5 模拟器看到新版外观、浴室和厨房画面及小新模型。当前工作区产物为 `nohara-house`，微信预览和真机待验。 [自动回归](../../tests/nohara-house.test.cjs)

## 小新模型重建与自审

2026-11-24。六个场景恢复挂载新版角色。头部和不对称脸颊共用一张连续曲面，发际线沿头皮绘制。眉眼与嘴形先按正面轮廓定位，再投到脸部曲面。红上衣、黄短裤、袜口和鞋底各有独立轮廓，抬手采用弯曲的手臂和分开的两指。角色由 TypeScript 生成，几何与材质随房间退出释放。 [角色模型](../../src/game/apps/nohara-house/three/shinnosuke.ts) · [房间挂载](../../src/game/apps/nohara-house/three/houseModels.ts)

**画面自审**　对照正面偏转、侧面偏转和背面渲染，先后修正了暖光下肤色偏黄、抬手被脸颊遮住、正面眼睛随脸颊拉斜的问题。随后从浏览器 App 入口在 390 × 820 视口点击全部房间按钮，逐张检查角色位置、衣色、眉眼和与家具的遮挡关系。院落中人物约 43 像素高，客厅约 60 像素高，嘴形和指尖以近景审图为准。 [角色三角度渲染](images/nohara-shinnosuke.png) · [六个场景实拍](images/nohara-shinnosuke-rooms.png)

**工程验证**　`nohara-house` 独立 WebGL1 构建、`npm.cmd run typecheck` 和全部 29 项测试通过。单个角色包含三个网格，检查了顶点数据、三角形索引以及三个几何体和三份材质的释放。微信开发者工具 Stable 1.06.2402030 的 iPhone 5 模拟器重新编译后能显示院落、切换客厅并绘制角色。开发者工具控制台同时报告缺失的旧 `.app-layout-check-*/dist/game.bundle.js` 和模块语法错误。本轮微信扫码预览与真机运行待验。

## 小新 2D 贴片

2026-11-24。六个房间的小新使用一张透明 256 × 256 PNG。头部约占全高 55%，用一侧鼓腮、粗眉、圆眼和短腿呈现二维卡通比例。Three.js Sprite 始终面向相机，从鞋底锚定房间中的原有站位，参与深度测试。PNG 作为首帧素材放入主包的 `characters/`，启动时通过框架加载器解码一次，房间切换时复用解码图像并释放旧 Sprite 的纹理和材质。修改绘制曲线后用 Pillow 运行 `python scripts/build-nohara-shinnosuke.py` 更新 PNG。 [角色贴图](../../media/nohara-house/packaged/characters/shinnosuke.png) · [绘制脚本](../../scripts/build-nohara-shinnosuke.py) · [贴片实现](../../src/game/apps/nohara-house/three/shinnosuke.ts)

**验证**　直接检查了贴图和两个相机方向的 WebGL1 绘制结果。以 390 × 820 视口在浏览器离线运行同一构建入口，核对院落首帧、拖动后与客厅切换后的眉眼、脸部轮廓和脚底位置。全仓类型检查及 34 项测试通过。为保留工作区已有的盐风庇护所产物，在 `.build/nohara-house-wechat-F1QEOK/` 单独执行了 `build:target -- nohara-house`，可将该目录导入微信开发者工具。微信模拟器、预览和真机待验。
