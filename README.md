# PixiWechatTest

基于 TypeScript、Three 和 PixiJS 的微信小游戏工程。每个应用有独立的 TypeScript 入口，支持在本地浏览器联调，并通过微信开发者工具做平台验收。

启动 Agent 开发任务时，把工作目录设为本工程根目录 `PixiWechatTest/`。开发从阅读 [AGENTS.md](AGENTS.md) 和 [AI 业务开发工作流](docs/AGENT_WORKFLOW.md) 开始。
应用改动、框架扩展和故障修复可按主题查询 [开发归档](docs/development/README.md)。

## 开始使用

使用 Node.js 22 LTS。在工程根目录安装依赖并启动一个 App 的网页预览。

```powershell
npm.cmd ci
npm.cmd run build:list
npm.cmd run dev:web -- nohara-house
```

在 Chrome 或 Edge 打开终端打印的 `http://127.0.0.1:<端口>/`。浏览器直接进入 App 首屏，保存已纳入构建的源码或素材后自动刷新。另开终端可以同时运行其他 App。网页预览在内存中构建，微信的 `dist/` 和 `game.json` 独立管理。 [网页联调流程](docs/AGENT_WORKFLOW.md#4-本地网页联调)

### 微信构建与验收

需要在微信开发者工具验收时，在工程根目录构建对应目标。

```powershell
npm.cmd run build:target -- showcase
```

在微信开发者工具中以小游戏模式导入当前目录并点击「编译」。集成首页的蓝色箭头进入配装台，紫色三色按钮进入 20 秒颜色匹配。

| 想运行的内容 | 命令 |
| --- | --- |
| 基础立方体与操作面板 | `npm.cmd run build:target -- controls` |
| 直接进入配装台 | `npm.cmd run build:target -- workbench` |
| 直接进入颜色匹配 | `npm.cmd run build:target -- color-match` |
| Pixi 图集、位图数字及点按 | `npm.cmd run build:target -- pixi-ui` |
| 直接进入海上避难所 | `npm.cmd run build:target -- ocean-shelter` |
| 直接进入野原家的小屋 | `npm.cmd run build:target -- nohara-house` |
| 首页、配装台与颜色匹配 | `npm.cmd run build:target -- showcase` |
| 独立模型或首页加模型 | `npm.cmd run build:target -- model-viewer`、`npm.cmd run build:target -- showcase-model` |
| WebGL2 基础、模型 | `npm.cmd run build:target -- webgl2`、`npm.cmd run build:target -- webgl2-model` |
| 查看或指定目标 | `npm.cmd run build:list`、`npm.cmd run build:target -- <目标名>` |

微信模型目标需要启动同级 `WechatAssetServer` 并核对 `src/game/common/model-viewer/modelAsset.ts` 的 URL。 [模型运行步骤](docs/ARCHITECTURE_AND_USAGE.md#32-启动模型联调)

## 框架与新增应用

- `src/framework/` 提供微信平台适配、共享渲染与输入、GLB／Draco 加载。
- `src/game/apps/` 为每个独立应用提供入口，集成首页位于 `showcase/`。
- `src/game/common/` 按功能保存实际共用的场景、玩法和 UI。
- `scripts/targets.json` 指定各目标的入口和包内素材。`dist/` 由构建生成，微信固定通过 `game.js` 加载当前产物。
- 在目标条目设置 `renderer` 可选 WebGL1 或 WebGL2，省略时使用 WebGL1。[渲染配置](docs/ARCHITECTURE_AND_USAGE.md#11-入口与渲染配置)

新增应用时，建一个应用目录并在 `scripts/targets.json` 登记入口，再执行 `npm.cmd run build:target -- <目标名>`。[新增应用与资源指南](docs/ARCHITECTURE_AND_USAGE.md#5-新增应用和素材)

`npm.cmd run typecheck` 检查全仓 TypeScript，`npm.cmd test` 运行自动回归。[框架架构与易用性审核](docs/FRAMEWORK_ARCHITECTURE.md) · [QA 与故障处理记录](docs/QA.md) · [迁移及 Agent 交接](docs/PROJECT_STATUS_AND_AGENT_HANDOFF.md)

## 海上避难所

构建 `ocean-shelter` 后，在微信开发者工具点击「编译」即可直达全船总览。支持单指转动、双指缩放和点按舱室。底部可切换舱室清单、船员、垂钓甲板、海况和全船总览，温室详情可进入移栽工作台。

入口、Three.js 场景、镜头和 Pixi HUD 位于 `src/game/apps/ocean-shelter/`。 `media/ocean-shelter/packaged/ui/` 的 HUD 素材随主包发布，`media/ocean-shelter/runtime/` 的模型、贴图和环境光由共享资源加载器读取。默认构建把运行素材放进微信资源分包。

远程部署时，将 `media/ocean-shelter/runtime/` 的内容按原目录结构发布到资源服务，再执行 `npm.cmd run build:target -- ocean-shelter --runtime-url https://你的资源域名/ocean-shelter/v1/`。该构建在运行时下载场景素材，主包继续提供 HUD。 [运行时资源配置](docs/ARCHITECTURE_AND_USAGE.md#运行时资源)

修改中文 HUD 文案后，可在带 Pillow 和宋体的 Windows 环境运行 `python scripts/build-ocean-glyphs.py` 更新字形图集。
