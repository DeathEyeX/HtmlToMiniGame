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
- `src/main.ts` 按编译期 `BUILD_PROFILE` 选择启动目标。
- `src/framework/` 提供微信平台、Three 与 Pixi 共享渲染、输入分流和资源加载。
- `src/game/startGameApp.ts` 管理首页和场景切换。`src/game/scenes/` 按场景存放 3D、UI 和业务状态。
- `src/examples/` 收纳基础操作、GLB、Pixi UI 和 WebGL2 的独立回归案例。

## Littlest Tokyo 模型回归

先启动同级 `WechatAssetServer`，并核对 `src/game/scenes/littlest-tokyo/modelAsset.ts` 的模型 URL。执行 `npm.cmd run build:model` 后重新编译，应同时看到 Littlest Tokyo 动画和 Pixi 面板。切换到 `npm.cmd run build` 可用立方体隔离启动故障。两个命令共用入口与产物路径。[模型运行说明](docs/ARCHITECTURE_AND_USAGE.md#32-启动模型联调)

真机联调时在日志确认 `[PixiHUD] clock-bridge-v2 function`，随后检查 `Pixi HUD initialized` 或首条 HUD 错误。开发者按[UI 验收清单](docs/ARCHITECTURE_AND_USAGE.md#4-ui-验收和扩展)复测，Agent 用 `npm.cmd test` 做自动回归。

历史故障、已用修复及剩余复测见 [QA 文档](docs/QA.md)。

框架内部拆分演示使用 `npm.cmd run build:app`。编译后点底部蓝色右箭头进入配装台，选择带 `01`–`03` 编号的色块，点对勾确认，点左箭头返回。图集在首次进入配装台时从包内读取，无需模型服务器。

首页紫色三色按钮进入限时颜色匹配。点播放开始，在 20 秒内选择与 3D 物体同色的按钮。计时结束可重开或返回首页。[操作验收与新增场景指南](docs/ARCHITECTURE_AND_USAGE.md#38-颜色匹配场景验收)

带模型入口的应用使用 `npm.cmd run build:app:model`。点击首页右侧绿色楼群进入 Littlest Tokyo，支持查看进度、返回和失败重试。[联合构建验收](docs/ARCHITECTURE_AND_USAGE.md#35-首页与模型联合验收)

WebGL2 专项使用 `npm.cmd run build:webgl2` 运行立方体与 HUD，使用 `npm.cmd run build:webgl2:model` 运行 Littlest Tokyo。各构建覆盖同一路径，微信工具在点「编译」后运行最后一次构建。[WebGL2 真机验收](docs/ARCHITECTURE_AND_USAGE.md#36-webgl2-专项诊断)

Pixi UI 专项使用 `npm.cmd run build:ui`。界面显示包内 PNG 四色 Sprite 与 BitmapText 数字。点击蓝色加号后计数加一，无需启动模型服务器。[Pixi UI 验收](docs/ARCHITECTURE_AND_USAGE.md#37-pixi-ui-专项诊断)

后续模块划分、资源发布方式及阶段验收见[框架目标架构](docs/FRAMEWORK_ARCHITECTURE.md)。
