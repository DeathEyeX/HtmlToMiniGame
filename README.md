# PixiWechatTest

基于 TypeScript、Three 和 PixiJS 的微信小游戏工程。每个应用有独立的 TypeScript 入口，构建后通过微信开发者工具导入工程根目录。

## 开始使用

使用 Node.js 22 LTS。在工程根目录运行以下命令。

```powershell
npm.cmd ci
npm.cmd run build:app
```

在微信开发者工具中以小游戏模式导入当前目录并点击「编译」。首页的蓝色箭头进入配装台，紫色三色按钮进入 20 秒颜色匹配。两个玩法均可离线启动。

| 想运行的内容 | 命令 |
| --- | --- |
| 基础立方体与操作面板 | `npm.cmd run build` |
| 直接进入配装台 | `npm.cmd run build:workbench` |
| 直接进入颜色匹配 | `npm.cmd run build:color-match` |
| Pixi 图集、位图数字及点按 | `npm.cmd run build:ui` |
| 首页与两个玩法 | `npm.cmd run build:app` |
| 独立模型或首页加模型 | `npm.cmd run build:model`、`npm.cmd run build:app:model` |
| WebGL2 基础、模型 | `npm.cmd run build:webgl2`、`npm.cmd run build:webgl2:model` |
| 查看或指定目标 | `npm.cmd run build:list`、`npm.cmd run build:target -- <目标名>` |

模型目标需要启动同级 `WechatAssetServer` 并核对 `src/game/common/model-viewer/modelAsset.ts` 的 URL。[模型运行步骤](docs/ARCHITECTURE_AND_USAGE.md#32-启动模型联调)

## 框架与新增应用

- `src/framework/` 提供微信平台适配、共享渲染与输入、GLB／Draco 加载。
- `src/game/apps/` 为每个独立应用提供入口，集成首页位于 `showcase/`。
- `src/game/common/` 按功能保存实际共用的场景、玩法和 UI。
- `scripts/targets.json` 指定各目标的入口和包内素材。`dist/` 由构建生成，微信固定通过 `game.js` 加载当前产物。

新增应用时，建一个应用目录并在 `scripts/targets.json` 登记入口，再执行 `npm.cmd run build:target -- <目标名>`。[新增应用与资源指南](docs/ARCHITECTURE_AND_USAGE.md#5-新增应用和素材)

`npm.cmd run typecheck` 检查全仓 TypeScript，`npm.cmd test` 运行自动回归。[框架架构与易用性审核](docs/FRAMEWORK_ARCHITECTURE.md) · [QA 与故障处理记录](docs/QA.md) · [迁移及 Agent 交接](docs/PROJECT_STATUS_AND_AGENT_HANDOFF.md)
