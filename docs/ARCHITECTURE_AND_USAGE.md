# PixiWechatTest 架构与使用指南

核对日期为 2026-11-23。这里描述当前工程的 TypeScript 入口、构建模式、平台适配、UI 扩展和验收流程。[目标架构与实施路线](FRAMEWORK_ARCHITECTURE.md) · [迁移与交接](PROJECT_STATUS_AND_AGENT_HANDOFF.md) · [QA 与故障处理记录](QA.md)

## 1. 当前基线

工程唯一框架入口为 `src/main.ts`，使用 esbuild 生成 ES2019 IIFE。3D 采用 `three-platformize@1.133.3` 与 WebGL1，2D 采用 `pixi.js@8.23.0` 的 Graphics、Container、Sprite 和 BitmapText。TypeScript 负责应用启动、场景、平台层及 HUD，现有 GLB 资源、Draco 和材质模块由模型场景调用。微信要求的 `game.js` 加载 `dist/game.bundle.js`。

| 用途 | 命令 | 运行结果 | 资源依赖 |
| --- | --- | --- | --- |
| 最小启动和平台排错 | `npm.cmd run build` | 程序化立方体和同一套 Pixi 面板 | 无模型下载、Draco 或项目外部贴图 |
| 3D 与 UI 联调 | `npm.cmd run build:model` | Littlest Tokyo GLB、Toon 材质、动画和 Pixi 面板 | 局域网 HTTP 资源或已命中的版本缓存 |
| 框架内部拆分 | `npm.cmd run build:app` | 首页、3D 配装台、Pixi 导航与场景往返 | 程序化几何。首次进入配装台读取包内 UI 图集，加载失败时保留矢量色块 |
| 首页与真实模型 | `npm.cmd run build:app:model` | 首页、配装台、Littlest Tokyo、进度、返回与重试 | 进入模型场景时下载或读取缓存 |
| WebGL2 基础诊断 | `npm.cmd run build:webgl2` | 原生绘制探针、立方体和 Pixi HUD | 目标运行环境的 WebGL2 |
| WebGL2 模型诊断 | `npm.cmd run build:webgl2:model` | 原生绘制探针、Littlest Tokyo、Draco、Toon、动画和 Pixi HUD | 目标运行环境的 WebGL2 及模型服务器或缓存 |
| Pixi UI 诊断 | `npm.cmd run build:ui` | 立方体、包内 PNG Sprite、BitmapText 和触摸计数 | 项目根目录的 `media/pixi-ui-probe.png` |
| 静态检查 | `npm.cmd run typecheck` | TypeScript 严格类型检查 | 覆盖 `src/**/*.ts` |
| 自动回归 | `npm.cmd test` | 微信运行时全局兼容、真实 OrbitControls、触摸捕获、共享帧循环与前后台测试 | 本地 Node 与已安装依赖 |

七个构建共用 `bundle` 脚本，写入同一个 `dist/game.bundle.js`。微信工具运行最后一次构建的模式。最小模式 1,046,207 字节，独立模型 1,756,918 字节，业务 1,102,440 字节，业务与模型联合 1,814,519 字节，WebGL2 基础诊断 1,049,085 字节，WebGL2 模型诊断 1,759,883 字节，Pixi UI 诊断 1,094,679 字节。均通过 ES2019 语法解析。原生绘制和 Pixi UI 探针只进入各自诊断，业务和 UI 诊断共享图集加载模块，带 `model` 的构建包含 GLB 加载和 Draco。实际预览包大小以微信开发者工具为准。

## 2. 运行架构

```text
npm run build       → 立方体排错
npm run build:model → 模型回归
npm run build:app   → 首页及配装台
npm run build:app:model → 首页、配装台及 Littlest Tokyo
                           ↓
              src/main.ts → esbuild → dist/game.bundle.js ← game.js
                           ↓
          runtime/startGame.ts → wx.createCanvas → WechatPlatform
                           ↓
   Cube.ts / LittlestTokyo.ts / Workbench.ts → Three 场景 / 相机 / OrbitControls
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
| `game.js`、`game.json`、`project.config.json` | 微信入口、竖屏、小游戏项目和打包规则。保持 `es6: false`，由 esbuild 提供兼容语法。源码、测试、文档和归档的 `libs/` 由打包规则排除。 |
| `src/main.ts` | 唯一 TypeScript 入口，按构建模式选择场景工厂，然后启动共享运行时。 |
| `src/runtime/startGame.ts` | 持有 Canvas、平台、渲染器、HUD、RAF、尺寸与前后台处理。绘制顺序为 Three 后叠加 Pixi。 |
| `src/diagnostics/webGL2.ts` | 在同一上屏 Canvas 请求 WebGL2，编译 GLSL ES 3.00 并绘制和读回像素。确认后给 Three 提供上下文，记录真实版本、模板缓冲及初始化结果。 |
| `src/scenes/Cube.ts` | 构建程序化立方体，以及独立的相机、灯光和旋转更新。 |
| `src/app/startApp.ts`、`AppHud.ts`、`Workbench.ts` | 应用导航、业务 UI 与 3D 配装逻辑。首页通过动态导入进入业务模块。返回时调用同一运行时的场景切换接口。 |
| `src/scenes/LittlestTokyo.ts` | 持有模型相机、灯光、动画和当前加载尝试。对应用提供状态、重试与退出释放，通过 `update(delta)` 接入共享帧循环。 |
| `src/platform/WechatPlatform.ts` | 继承已验证的 `WechatGamePlatform`。沿用其微信原生触摸订阅，仅在手势开始时询问 HUD 是否接管按钮、开关、滑块或拖动把手。起点在场景的手势走原 OrbitControls。 |
| `src/ui/loadHud.ts` | 在延迟加载 Pixi 之前补齐缺失的 `navigator` 和 `performance.now()`。构建把 Pixi 的裸 `performance`、`Intl` 引用映射到对应的 `globalThis` 属性。 |
| `src/ui/PixiHud.ts` | 配置微信 Canvas 适配，使用 Pixi 的静态代码兼容模块。通过 `beginGesture` 提供控件命中，返回 `move / release / cancel`。矩形、色条及数字由矢量 Graphics 生成，面板位置和缩放由 Container 管理。 |
| `src/ui/packagedUIAtlas.ts`、`src/assets/loadPackagedImage.ts` | 以 `wx.createImage` 解码包内图集，提供共用纹理和位图数字。BitmapText 扩展在渲染器初始化前注册。配装台首入时请求图集，成功后在应用存活期间复用。 |
| `src/assets/modelCatalog.ts`、`loadModelGLB.ts`、`WechatAssetLoader.js` | 按资源 ID 取 URL 和版本，调用 `wx.downloadFile` 及微信文件系统。加载器验证 GLB 头、长度和解析结果，验收后持久化。缓存按 `<cacheKey>-<version>.glb` 存储在 `wx.env.USER_DATA_PATH/three-model-cache`。解析失败的缓存尝试删除，下一次重试跳过该条缓存。 |
| `src/draco/WechatDracoLoader.js`、`src/draco/draco_decoder.js` | 适配版 GLTFLoader 接口、纯 JS 解码、顶点属性和索引生成及临时对象释放。模型正常路径无需 Worker 或单独的 WASM 文件。 |
| `src/rendering/AnimeToonMaterial.js` | 将适用的模型材质转换为 Toon，保留基础贴图，使用 WebGL1 兼容的 `LuminanceFormat` 渐变纹理。 |

**渲染边界。** 入口创建上屏 Canvas，先绘制 Three，再重置状态并叠加 Pixi。Pixi 绘制时关闭清屏。业务首屏导航由 Graphics 绘制，BitmapText 扩展随业务 HUD 注册，图片留到配装台首入时解码。输入由微信触摸桥处理。新增 UI 扩展时先验证相关平台能力，尤其是 Text 的 Canvas 纹理、图片解码和联调包大小。

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

新的开发机执行 `npm ci` 时需要能访问配置的 npm 源或有完整本地缓存。审查环境使用 Node 22.18.0 和 npm 11.5.2。

### 3.2 启动模型联调

在单独终端运行资源服务器：

```powershell
Set-Location 'D:\Project\Web\ThreeJsTest'
python -m http.server 8080 --bind 0.0.0.0 --directory '.\WechatAssetServer'
```

确认该目录下有 `model.glb`。现有资源与网页原型的 `littlest-tokyo-vite/public/models/LittlestTokyo.glb` 字节相同。用 `ipconfig` 核对手机可达的网卡 IP，必要时更新 `src/assets/modelCatalog.ts` 中 `littlestTokyo.url`。当前配置为 `http://192.168.1.46:8080/model.glb`。换模型或换资源来源时一起更新 `version`，以便重新下载。

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

### 3.4 框架内部拆分验收

执行 `npm.cmd run build:app` 后在开发者工具点击「编译」。本模式无需模型服务器。

1. 首页应显示旋转立方体，底部只有蓝色右箭头。点箭头进入配装台。
2. 首次进入后，三个色块应显示位图编号 `01`、`02`、`03`，日志应出现一次 `[App] Workbench palette ready`。点色块，几何模型应立即换色，当前色块有白边。点右侧对勾，模型开始旋转，按钮显示确认状态。面板外拖动可转视角。
3. 点左箭头返回，再进入。首页隐藏配色选项，重进恢复初始颜色和未确认状态，并复用已解码的同一张图集。快速重复点入口只进入一次。切后台再返回，检查视角、帧循环与触摸。
4. 若图片仍在加载或加载失败，原有矢量色块仍可选色和确认。失败时查找 `[App] Workbench uses Graphics swatches`，核对 `media/pixi-ui-probe.png` 是否进入项目包。

当前该业务演示同首屏一起输出到现有 bundle。源码边界已拆开，物理 JS 文件拆分与微信官方分包按单文件、主包和首屏测量结果后置。

### 3.5 首页与模型联合验收

启动 §3.2 的资源服务器，执行 `npm.cmd run build:app:model`，在微信工具重新编译。首页保留配装台的蓝色箭头，最右侧绿色楼群打开模型。进入前可观察服务器无模型请求。

1. 使用新测试版本验证冷加载。进入时可见进度，模型就绪后进度条变为绿色。核对日志的 71 个网格、193,125 个顶点和 `Take 001`，拖动验证视角。
2. 放慢下载后点击左箭头。确认返回首页后立方体、配装台和触摸正常，模型加载中或解析中途退出后无迟到画面。下载在途调用微信下载任务的 `abort`，已开始的同步解码会完成当前计算。
3. 用新缓存版本并停止服务，或让测试地址返回非 200。模型失败应提示重试或返回。恢复服务后点重试，等待 `Scene ready` 及 `Cache saved`。返回并再次打开应出现 `Cache hit`，无需下载同版本模型。
4. 验证从已加载模型返回首页后色调恢复，配装台仍可换色和确认。最终复测开发者工具及真机，并记录终端和基础库版本。

### 3.6 WebGL2 专项诊断

先用 `npm.cmd run build:webgl2`。这个构建使用程序化立方体和已有 Pixi HUD，可在停止模型服务器的情况下验证。探针始终请求 WebGL2，失败会显示诊断提示。正式应用基线继续使用 WebGL1。

1. 在微信工具重新编译，在目标 iOS、Android 分别重新扫码。记录系统、微信、基础库、`[WebGL2] Environment` 及实际运行模式。同一手机的普通模式和高性能模式如均需覆盖，分别记录。
2. 检查 `Native context`、`Native draw verified`、`Three WebGL version 2` 和 `Pixi WebGL version 2`。首帧有 `GL_NO_ERROR` 后，再检查立方体、计数按钮、拖动、滑块、遮罩和前后台恢复。模板缓冲实测值和遮罩画面一并记录。
3. 前述通过后启动模型服务器，切换到 `npm.cmd run build:webgl2:model`。检查模型、内嵌贴图、Toon、动画和 Pixi 同屏。模型日志应有 71 个网格、193,125 个顶点及 `Take 001`。当前已测样本使用 `RedFormat` 梯度走 WebGL2 的 R8 纹理路径，WebGL1 模型继续用原 `LuminanceFormat`。设备出现黑屏、贴图或遮罩异常时，提供最先缺失的阶段日志和首条 GL 错误。
4. 恢复正式回归时执行 `npm.cmd run build:app:model` 并重新编译。通过一个平台的诊断只证明该设备和当前微信运行模式。

原生探针编译 GLSL ES 3.00、使用顶点数组并校验绘制结果。Three 与 Pixi 各自识别共享上下文版本。两者叠加使用同一个 Canvas，Pixi 遮罩需检查实际模板缓冲。[WebGL2 规范](https://registry.khronos.org/webgl/specs/latest/2.0/) · [Pixi 共享上下文指南](https://pixijs.com/8.x/guides/third-party/mixing-three-and-pixi)

### 3.7 Pixi UI 专项诊断

执行 `npm.cmd run build:ui` 后在微信工具点「编译」，无需模型服务器。诊断复用 WebGL1、共享 Canvas 和原生触摸分流。配装台和诊断共用一张 402 字节的包内 PNG，提供 Sprite 和预渲染数字字形。业务构建的 JS 依赖图排除 UI 探针。

1. 确认立方体与左上 HUD 同屏。HUD 左侧是四色 Sprite，右侧顶部显示 `012345`。
2. 点蓝色加号，数字应变成 `012346`。按下后拖出并释放时数字保持原值。从面板外拖动应旋转立方体。
3. 调整视口或切后台再返回，确认字体、图像与按钮的显示和命中一致。手机扫码后对照同一用例。记录工具、微信、设备、基础库及首条异常。
4. 日志 `[PixiUI] Package image decoded` 表示已读取包内 PNG，`Sprite and BitmapText mounted` 表示已挂载场景树。以屏幕上的四色块、数字及点击变化分别确认纹理和刷新。加载失败时检查项目导入目录、包分析中的 `media/pixi-ui-probe.png` 和首条 HUD 错误。

真机出现 `ReferenceError: Intl is not defined` 时，确认重新构建并生成新预览码。构建把 Pixi 的 `Intl` 引用映射到 `globalThis.Intl`，宿主缺少该 API 时由 Pixi 按 Unicode 码点分割文字，覆盖本样例的数字。宿主有原生 `Intl.Segmenter` 时继续使用原生实现。

诊断用 `wx.createImage` 加载本地图片，交给显式的 Pixi `ImageSource`。在创建 Pixi 渲染器前注册 BitmapText 扩展，数字共用图集。此样例覆盖预渲染的十个阿拉伯数字。Canvas 动态文字、中文字体、长列表按业务需要分别验收。[Pixi BitmapText 指南](https://pixijs.com/8.x/guides/components/scene-objects/text/bitmap) · [Pixi 纹理指南](https://pixijs.com/8.x/guides/components/textures)

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

开发者已确认首页与模型联合构建、WebGL2 专项和 Pixi UI 的 `Intl` 修复通过验收，记录未附完整设备信息。本轮 17 项自动回归、类型检查和七种模式的构建与 ES2019 语法检查通过。新增配装台色块和位图编号已在桌面软件 WebGL 中验证，微信工具和手机待按 §3.4 验收。

新增控件时在 HUD 内定义视觉、命中区域和状态更新，单击动作在 `release` 内提交，拖动控件在 `move` 内更新，取消时恢复临时交互状态。新增业务场景可参照 `src/app/Workbench.ts` 提供相机、控制器、更新和释放，在 `src/app/startApp.ts` 接入导航，复用平台、RAF 和 HUD。

## 5. 审查结论与下一阶段

现有磁盘产物对应 `build:app`。先按 §3.4 验证配装台的 Sprite、BitmapText 与已有选色流程，再按 §3.5 验证带模型入口的应用。业务 UI、物理 JS 拆分和微信分包的实施口径见[目标架构的分阶段验收](FRAMEWORK_ARCHITECTURE.md#5-分阶段实施与验收)。
