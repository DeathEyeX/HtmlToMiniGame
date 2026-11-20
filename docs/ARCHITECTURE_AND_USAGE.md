# PixiWechatTest 架构与使用指南

核对日期为 2026-11-20。这里描述当前工程的两个构建入口、平台适配、UI 扩展和验收流程。[历史问题、迁移过程及详细任务拆分](PROJECT_STATUS_AND_AGENT_HANDOFF.md)

## 1. 当前基线

工程使用 TypeScript 开发共享平台层、Pixi HUD 和程序化场景，使用 esbuild 生成 ES2019 IIFE。3D 采用 `three-platformize@1.133.3` 与 WebGL1，2D 采用 `pixi.js@8.23.0` 的 Graphics 和 Container。模型演示入口和现有 GLB／Draco 实现仍是 JavaScript。微信入口 `game.js` 只加载 `dist/game.bundle.js`。

| 用途 | 命令 | 运行结果 | 资源依赖 |
| --- | --- | --- | --- |
| 最小启动和平台排错 | `npm.cmd run build` | 程序化立方体和同一套 Pixi 面板 | 无模型下载、Draco 或项目外部贴图 |
| 3D 与 UI 联调 | `npm.cmd run build:model` | Littlest Tokyo GLB、Toon 材质、动画和 Pixi 面板 | 局域网 HTTP 资源或已命中的版本缓存 |
| 静态检查 | `npm.cmd run typecheck` | TypeScript 严格类型检查 | 覆盖 `src/**/*.ts` |
| 自动回归 | `npm.cmd test` | 微信运行时全局兼容、真实 OrbitControls 和触摸捕获测试 | 本地 Node 与已安装依赖 |

两个构建写入同一个 `dist/game.bundle.js`。微信工具始终运行最后一次构建的模式。当前磁盘 bundle 与模型模式重建结果逐字节一致。审查时按两条命令的配置在内存重建，最小模式为 1,044,390 字节，模型模式为 1,753,756 字节，均通过 ES2019 语法解析。这些是 JS 文件大小，实际预览包大小以微信开发者工具为准。

## 2. 运行架构

```text
npm run build       → src/main.ts（立方体）
npm run build:model → src/three-test.js（Littlest Tokyo）
                           ↓
                    esbuild → dist/game.bundle.js ← game.js
                           ↓
                  wx.createCanvas → WechatPlatform
                           ↓
              Three 场景 / 相机 / OrbitControls
                           ↓
           同一上屏 Canvas 和同一 WebGL1 上下文
                           ↓
                每帧先绘制 3D，再绘制 Pixi HUD

模型分支
wx.downloadFile / 版本缓存 → ArrayBuffer → GLTFLoader.parse
  → WechatDracoLoader → 几何 / 内嵌纹理 → Toon 材质和 AnimationMixer
```

| 模块 | 职责与依赖 |
| --- | --- |
| `game.js`、`game.json`、`project.config.json` | 微信入口、竖屏、小游戏项目和打包规则。保持 `es6: false`，由 esbuild 提供兼容语法。源码、测试、文档和既有的 Draco/WASM 实验产物由打包规则排除。 |
| `src/main.ts` | 程序化立方体、场景、相机、RAF、窗口尺寸及前后台。用于快速验证框架启动，便于区分渲染错误和远程资源错误。 |
| `src/three-test.js` | 真实模型联调。持有模型 URL、版本、相机、灯光、渲染循环与动画。创建场景后并行初始化 HUD 和加载模型，共用相同输入路由。 |
| `src/platform/WechatPlatform.ts` | 继承已验证的 `WechatGamePlatform`。沿用其微信原生触摸订阅，仅在手势开始时询问 HUD 是否接管按钮、开关、滑块或拖动把手。起点在场景的手势走原 OrbitControls。 |
| `src/ui/loadHud.ts` | 在延迟加载 Pixi 之前补齐缺失的 `navigator` 和 `performance.now()`。构建把 Pixi 的裸 `performance` 引用映射到 `globalThis.performance`。 |
| `src/ui/PixiHud.ts` | 配置微信 Canvas 适配，使用 Pixi 的静态代码兼容模块。通过 `beginGesture` 提供控件命中，返回 `move / release / cancel`。矩形、色条及数字由矢量 Graphics 生成，面板位置和缩放由 Container 管理。 |
| `src/assets/WechatAssetLoader.js` | 用 `wx.downloadFile` 下载，校验 GLB 头、版本和长度，读入 ArrayBuffer 后持久化。缓存文件名为 `<cacheKey>-<version>.glb`，存放在 `wx.env.USER_DATA_PATH/three-model-cache`。读缓存失败或头部异常时尝试删除该文件并重下。 |
| `src/draco/WechatDracoLoader.js`、`src/draco/draco_decoder.js` | 适配版 GLTFLoader 接口、纯 JS 解码、顶点属性和索引生成及临时对象释放。模型正常路径无需 Worker 或单独的 WASM 文件。 |
| `src/rendering/AnimeToonMaterial.js` | 将适用的模型材质转换为 Toon，保留基础贴图，使用 WebGL1 兼容的 `LuminanceFormat` 渐变纹理。 |

**渲染边界。** 入口创建上屏 Canvas，先绘制 Three，再重置状态并叠加 Pixi。Pixi 绘制时关闭清屏。首屏只启用 Graphics 等所需扩展，输入由微信触摸桥处理。新增 UI 扩展时先验证相关平台能力，尤其是 Text 的 Canvas 纹理、图片解码和联调包大小。

**手势归属。** 控件在初次按下时完成命中。命中控件后，平台持续交给同一个手势处理器，直到释放或取消。坐标超出控件仍可用于面板移动和滑块更新，点按控件则会在拖出后取消激活。模型手势从 3D 区域开始后，即使经过控件，也继续交给场景。当前接入验证的是 Pixi 渲染与微信侧手势管理，Pixi 自带的事件系统及浏览器 DOM 输入属于额外能力。

## 3. 安装与运行

### 3.1 在微信开发者工具运行最小模式

```powershell
Set-Location 'D:\Project\Web\ThreeJsTest\PixiWechatTest'
npm.cmd ci
npm.cmd test
npm.cmd run build
```

1. 在微信开发者工具导入该工程根目录，使用小游戏模式和有项目权限的微信账号。启动后点击「编译」验证立方体和面板。
2. 如果新编译后所有模拟器输入都失效，关闭当前工程窗口并重新打开同一项目。在 Stable 1.06.2402030 的既有异常会话中已经用同一业务包做过对照，重开恢复了点击和拖动。

锁文件含 GitHub Git 依赖。新的开发机执行 `npm ci` 时需要能访问配置的 npm 源和 GitHub。审查环境使用 Node 22.18.0 和 npm 11.5.2。

### 3.2 启动模型联调

在单独终端运行资源服务器：

```powershell
Set-Location 'D:\Project\Web\ThreeJsTest'
python -m http.server 8080 --bind 0.0.0.0 --directory '.\WechatAssetServer'
```

确认该目录下有 `model.glb`。现有资源与网页原型的 `littlest-tokyo-vite/public/models/LittlestTokyo.glb` 字节相同。用 `ipconfig` 核对手机可达的网卡 IP，必要时更新 `src/three-test.js` 中的 `CONFIG.modelURL`。当前配置为 `http://192.168.1.46:8080/model.glb`。换模型或换资源来源时一起更新 `modelVersion`，以便重新下载。

```powershell
Set-Location 'D:\Project\Web\ThreeJsTest\PixiWechatTest'
npm.cmd run build:model
```

在开发者工具点击「编译」。正常日志包括 `[ThreeDraco] Renderer initialized`、`[PixiHUD] clock-bridge-v2 function`、`Pixi HUD initialized`、`Resource ready`、`GLB parsed` 和 `Scene ready`。现有模型回归的参考值是 71 个网格、193,125 个顶点与 1 段动画。HUD 日志和模型日志可以交错出现。

### 3.3 真机预览与日志定位

- **局域网联调**使用同一网络的电脑和手机，确保模型服务器持续运行。开发者生成新预览二维码，按需要开启手机端开发者调试。局域网调试和免调试的发布环境分别记录。
- **公开资源联调**需要项目实际的 HTTPS 模型地址和为 AppID 登记的 `downloadFile` 合法域名。更换模型缓存版本，在手机关闭开发者调试时复测冷下载，再次进入验证热缓存。详细流程见[交接文档真机预览](PROJECT_STATUS_AND_AGENT_HANDOFF.md#74-关闭调试的普通扫码验收)。
- **模型可见但 UI 缺失**时检查 `clock-bridge-v2`，随后记录 HUD 初始化或渲染的第一条错误。
- **UI 可见但模型缺失**时对照 `Resource ready`、`GLB parsed` 和服务端 GET。命中缓存时服务器不会收到 GET。资源已就绪但解析持续等待时，检查 Draco 错误。
- **工具能看到模型和 UI，但所有输入失效**时按 §3.1 重开项目并复测。记录 IDE 版本、基础库及是否重开即可恢复。

## 4. UI 验收和扩展

开发者负责微信开发者工具及手机上的交互验收，Agent 负责实现、类型检查、自动测试和构建。失败时保留设备、微信和基础库版本，连同操作、期望、实际表现及首条相关日志回传。

| 用例 | 可重复的验收动作 |
| --- | --- |
| 计数与释放 | 蓝色 `+` 按钮内按下并释放，计数加一。按住拖出后释放，计数与视角保持原样。 |
| 开关 | 点右侧开关两次，底部彩条隐藏后恢复。 |
| 连续值 | 拖动滑块，数值在 0–100 内连续变化，彩条透明度跟随。 |
| 遮罩 | 彩条只在底部预览槽内显示，拖动整个面板后仍按新位置裁剪。 |
| 拖动与命中 | 拖动顶部双线把手，面板与所有子控件一起移动。放下后在新位置点击 `+`，计数继续增加。 |
| 3D 输入隔离 | 在面板外开始拖动，模型视角旋转，面板位置与计数保持原样。 |

开发者已确认上述操作通过，当前记录未附设备型号和基础库版本。此前模拟器已观察到开关、计数、滑块透明度和整块面板移动。审查时重新执行了 6 项自动回归及类型检查。自动化覆盖启动适配和输入路由，实际 GPU 画面、设备差异及生命周期仍依赖界面验收。

新增控件时在 HUD 内定义视觉、命中区域和状态更新，保持模型或业务逻辑通过明确动作调用。单击动作在 `release` 内提交，拖动控件在 `move` 内更新，取消时恢复临时交互状态。新增关卡可先接入原有模型联调入口，共用平台、HUD 与资源能力，再逐步将业务入口迁移到 TypeScript。

## 5. 审查结论与下一阶段

当前可作为 **TypeScript 微信框架和 Three + Pixi 交互的开发基线**。继续保留已验收的共享 Canvas、原生触摸订阅、GLB／Draco 和 ES2019 启动顺序。推荐按以下顺序收敛：

| 顺序 | 事项 | 完成标准 |
| --- | --- | --- |
| 1 | 固定可复现基线 | 审核并提交现有入口、平台、HUD、资源、Draco 工厂、测试和锁文件。明确产物入库策略，记录构建模式和通过验收的环境。 |
| 2 | 收口模型加载失败 | 已用合法 GLB 容器和损坏 Draco 片段复现解码 Promise 被拒绝、`GLTFLoader.parse` 回调悬挂。需要接通错误传播和有界等待，提供可见错误／重试，并明确失效缓存何时清除。 |
| 3 | 统一两个入口的生命周期 | 模型入口仍为 JavaScript，前后台处理仅在立方体入口实现。将已验证的 Canvas、帧循环、窗口更新和暂停／恢复抽到共享 TypeScript 启动模块，再让两种场景复用。保留无资源模式作为故障隔离入口。 |
| 4 | 扩展 UI 能力与真机矩阵 | 依次验证 Text 或 BitmapText、Sprite 及包内纹理、长列表或滚动、HUD 拖动时前后台切换和多指输入。为每项记录目标手机、微信基础库、测试素材和预期画面。通过后再提炼通用控件。 |
| 5 | 验收发布环境 | 使用新缓存版本从 HTTPS 完成关闭调试的冷下载，复测热缓存。使用目标 iOS 与 Android 核对 UI、帧率及内存。 |
