# 海上避难所开发记录

## 独立 App 迁移

**范围**　2026-11-23，`ocean-shelter`，源码基线可查 `d845c47`。

**背景**　将 HTML 原型中的 UI 和 Three.js 场景迁到微信小游戏。早期接线曾放在 Showcase 首页，最终确认由独立构建目标直达全船总览。

**改动**　场景创建与动画、相机及触摸、Pixi HUD、素材读取分别由 App 自己的模块负责。单指转船、双指缩放、舱室清单、船员、垂钓甲板、海况、总览和温室移栽工作台都由该目标装配。检查入口、分包或切换构建后的资源残留时，先对照目标清单。 [入口](../../src/game/apps/ocean-shelter/main.ts) · [场景](../../src/game/apps/ocean-shelter/three/OceanShelter.ts) · [镜头](../../src/game/apps/ocean-shelter/three/OceanCamera.ts) · [HUD](../../src/game/apps/ocean-shelter/hud/OceanShelterHud.ts) · [目标清单](../../scripts/targets.json)

**验证**　`npm.cmd run build:target -- ocean-shelter` 构建后，微信开发者工具直接显示全船总览。迁移阶段实测过温室聚焦、工作台特写和返回总览。目标隔离由自动测试覆盖。 [构建隔离测试](../../tests/build-targets.test.cjs)

## 场景素材分离

**范围**　2026-11-24，`ocean-shelter`，默认微信分包和远程构建均纳入验证。

**改动**　HUD 源文件位于 `media/ocean-shelter/packaged/ui/`。场景素材位于 `media/ocean-shelter/runtime/`，其中 `models/galley/` 保持 GLB 与外部贴图的相对路径。App 用同一个运行资源源读取模型和其贴图。遇到字形缺失时，查 `hud/hudCopy.ts`、`content.ts` 与生成脚本，修改文案后重建字形图集。 [场景资源](../../src/game/apps/ocean-shelter/three/assets.ts) · [HUD 资源](../../src/game/apps/ocean-shelter/hud/assets.ts) · [字形脚本](../../scripts/build-ocean-glyphs.py) · [框架资源记录](framework.md#主包与运行时资源)

**验证**　默认构建和本机 HTTP 下载版均在微信模拟器显示完整场景与 HUD。服务器记录确认 GLB、外部贴图和 HDR 的请求返回 200。公网 HTTPS 真机链路待验。较早一次真机预览码生成对应上一版资源布局，详情见 [旧素材预览修复](wechat-preview-enoent.md)。
