# TypeScript 微信小游戏框架

默认示例在微信上屏 Canvas 内绘制 Three.js 立方体和 PixiJS 验证面板。立方体由代码生成，默认构建无需 GLB、外部贴图、缓存或资源服务器。依赖、运行架构、资源和手势分流详见[架构与使用指南](docs/ARCHITECTURE_AND_USAGE.md)。

## 安装与运行

```powershell
npm.cmd ci
npm.cmd run build
```

在微信开发者工具中导入本目录，选择小游戏并编译。点击蓝色按钮会增加计数，按钮外拖动可旋转相机。构建先运行 TypeScript 严格检查，再通过 esbuild 生成 `dist/game.bundle.js`，由 `game.js` 加载。

## 从哪里开始开发

- `src/main.ts` 是唯一 TypeScript 入口，选择回归场景并启动运行时。
- `src/runtime/startGame.ts` 管理 Canvas、平台、共享渲染循环、HUD 及前后台事件。
- `src/scenes/Cube.ts` 是无需外部资源的几何回归场景。
- `src/scenes/LittlestTokyo.ts` 配置模型资源、相机、灯光和动画。
- `src/ui/PixiHud.ts` 定义计数、开关、透明度滑块、遮罩及可拖动面板。
- `src/platform/WechatPlatform.ts` 将微信触摸分流给 HUD 或 Three.js 控制器。

## Littlest Tokyo 模型回归

先按[交接文档](docs/PROJECT_STATUS_AND_AGENT_HANDOFF.md)启动同级 `WechatAssetServer`，并核对 `src/scenes/LittlestTokyo.ts` 的模型 URL。执行 `npm.cmd run build:model` 后重新编译，应同时看到 Littlest Tokyo 动画和 Pixi 面板。立方体构建用于隔离启动故障，可通过 `npm.cmd run build` 切换。两个命令共用入口与产物路径。

真机联调时在日志确认 `[PixiHUD] clock-bridge-v2 function`，随后检查 `Pixi HUD initialized` 或首条 HUD 错误。开发者按[UI 验收清单](docs/ARCHITECTURE_AND_USAGE.md#4-ui-验收和扩展)复测，Agent 用 `npm.cmd test` 做自动回归。

历史故障、已用修复及剩余复测见 [QA 文档](docs/QA.md)。

后续模块划分、资源发布方式及阶段验收见[框架目标架构](docs/FRAMEWORK_ARCHITECTURE.md)。
