# HtmlToMiniGame

简体中文 · [English](README.en.md)

HtmlToMiniGame 是一套将交互式 Web 原型移植到微信小游戏的 TypeScript 工程。Three.js（`three-platformize`）负责 3D 场景，PixiJS 负责 HUD。共享运行时管理 Canvas、WebGL 上下文、帧循环和输入分流。每个应用都可以独立在浏览器预览或构建为微信小游戏。

## 快速开始

### 1. 克隆仓库并安装依赖

先安装 Git 和 Node.js（推荐 22，随附 npm）。然后从 GitHub 克隆并安装项目依赖。

```sh
git clone https://github.com/DeathEyeX/HtmlToMiniGame.git
cd HtmlToMiniGame
npm ci
```

`npm ci` 按仓库里的 `package-lock.json` 安装运行和构建依赖，需要能访问 npm 软件源或已有完整缓存。项目的框架和应用源码随仓库提供，Git 子模块初始化可跳过。Windows PowerShell 如果拦截 `npm.ps1`，把下文命令中的 `npm` 换成 `npm.cmd`，例如 `npm.cmd ci`。

### 2. 在浏览器运行

安装依赖后，在仓库根目录运行以下命令。`showcase` 所需素材随仓库提供。

```sh
npm run build:list
npm run dev:web -- showcase
```

打开终端打印的本地地址。Showcase 首页的蓝色箭头进入配装台，紫色三色按钮进入 20 秒颜色匹配。修改已纳入构建的源码或素材后，页面会自动刷新。新增、删除或重命名素材，以及修改目标配置后，需要重启预览。按 `Ctrl+C` 停止预览。

### 3. 在微信开发者工具运行

安装依赖后，在仓库根目录构建目标，生成所选应用的代码和素材。

```sh
npm run build:target -- showcase
```

在微信开发者工具中以「小游戏」模式导入仓库根目录。若当前账号对仓库配置的 AppID 无权限，导入时选择有权限的小游戏 AppID，再点击「编译」。切换应用时，将命令中的 `showcase` 换成对应的目标 ID，重新构建后再点击「编译」。各目标共用一份 `dist/` 和 `game.json` 中由构建管理的分包配置。网页预览在内存中构建，可以与微信开发者工具并行使用。 [本地联调与微信验收流程](docs/AGENT_WORKFLOW.md#4-本地网页联调)

## 示例应用

| 目标 | 内容 |
| --- | --- |
| `showcase` | 集成首页，包含配装台和颜色匹配入口 |
| `workbench` / `color-match` | 独立运行配装台或 20 秒颜色匹配 |
| `ocean-shelter` | 船体总览、舱室交互和温室移栽工作台 |
| `nohara-house` | 可拖动视角、切换房间的卡通住宅 |
| `drift-era` | 像素风海上庇护所，包含跨层通行和电台联络任务 |
| `tidal-harbor` | 可在海上庇护所、水线和海底之间切换的 3D 场景 |
| `saltwind-haven` | 模块化浮台、动态海面和功能区聚焦 |
| `mad-water-haven` | 海上住宅和水下避难所，支持潜水观察 |
| `controls` / `pixi-ui` / `webgl2` | 基础输入、Pixi 图集与点按、WebGL2 示例 |
| `model-viewer` / `showcase-model` / `webgl2-model` | GLB／Draco 模型加载示例，需要单独提供 `model.glb` |

完整列表以 `npm run build:list` 为准。运行表中的三个模型示例时，需要另行准备 `model.glb`。网页预览优先读取仓库同级的 `../WechatAssetServer/model.glb`。在微信端运行时，需要启动模型资源服务，并在 `src/game/common/model-viewer/modelAsset.ts` 中填入设备可访问的模型 URL。 [模型联调说明](docs/ARCHITECTURE_AND_USAGE.md#32-启动模型联调)

## 项目结构与扩展

| 路径 | 用途 |
| --- | --- |
| [`src/framework/`](src/framework/) | 平台适配、共享渲染与输入、资源加载 |
| [`src/game/apps/`](src/game/apps/) | 各应用入口、Three.js 场景和 Pixi HUD |
| [`src/game/common/`](src/game/common/) | 多个应用共用的场景、玩法和 UI |
| [`media/`](media/) | HUD 图集、模型、贴图和其他源素材 |
| [`scripts/targets.json`](scripts/targets.json) | 目标入口、WebGL 模式和素材声明 |

新增应用时，在 `src/game/apps/<app-id>/main.ts` 调用 `startGame` 装配场景和 HUD，并在 `scripts/targets.json` 注册同名目标。默认使用 WebGL1，可通过目标的 `renderer` 字段选择 WebGL2。 [新增应用与素材](docs/ARCHITECTURE_AND_USAGE.md#5-新增应用和素材)

`packagedResources` 随微信主包提供，`runtimeResources` 默认进入微信资源分包。以 `ocean-shelter` 为例，也可以将 `media/ocean-shelter/runtime/` 的内容按原目录结构部署到资源服务，再构建远程资源版。将示例地址替换为自己的资源目录 URL。 [运行时资源配置](docs/ARCHITECTURE_AND_USAGE.md#运行时资源)

```sh
npm run build:target -- ocean-shelter --runtime-url https://assets.example.com/ocean-shelter/v1/
```

## 开发检查与文档

```sh
npm run typecheck
npm test
```

本地工具支持检查和迁移 HTML 原型、无头浏览器首帧、HUD 触摸区域以及微信构建资源。使用 `npm run build:web -- ocean-shelter` 生成可部署网页，或用 `npm run build:target -- ocean-shelter --isolated` 生成可单独导入的微信项目。GitHub Actions 会运行回归并保留报告、截图和海上避难所 Web 构建。 [本地工具用法](docs/LOCAL_TOOLS.md)

历史文档中的 `PixiWechatTest` 指本项目。文档示例中的本地目录请替换为你的仓库路径。

- [框架架构](docs/FRAMEWORK_ARCHITECTURE.md)
- [架构与使用指南](docs/ARCHITECTURE_AND_USAGE.md)
- [AI 开发约定](AGENTS.md) · [业务开发工作流](docs/AGENT_WORKFLOW.md)
- [开发归档](docs/development/README.md) · [QA 与故障处理](docs/QA.md)
