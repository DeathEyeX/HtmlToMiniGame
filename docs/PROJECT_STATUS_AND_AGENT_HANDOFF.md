# PixiWechatTest 项目状态与 Agent 开发交接

核对日期为 2026-11-23。工程根目录为 `D:\Project\Web\ThreeJsTest\PixiWechatTest`。目标是可复用的微信小游戏框架，业务使用 TypeScript，3D 使用 Three.js，2D UI 暂定 PixiJS。现有 Littlest Tokyo 示例提供已跑通的 3D、Draco 和资源链路。

## 1. 接手结论

[架构与使用指南](ARCHITECTURE_AND_USAGE.md)说明如何构建和扩展。[QA 文档](QA.md)收录历史问题、处理方案及验证状态。[框架架构与易用性审核](FRAMEWORK_ARCHITECTURE.md)记录目录、依赖和接入验证。本文保留模型迁移和首版任务。

### 本轮实现状态

- 九个目标由 `scripts/targets.json` 各自指定 TypeScript 入口，生成微信 `game.js` 加载的 ES2019 IIFE。目标类型检查跟随入口依赖，构建按清单收集 `dist/resources/` 素材。轻量集成包排除模型 HUD、GLB／Draco 和 WebGL2 探针。
- 微信开发者工具 Stable 1.06.2402030 已显示旋转立方体和 Pixi 矢量计数按钮。微信限制动态代码生成，HUD 使用 Pixi 提供的静态兼容模块。文字纹理在该模拟器上未显示，示例计数改为矢量数字。微信触摸路由通过自动回归，统一入口后的新包待开发者手动复测。
- 真机微信基础库 3.17.6 上报告了 `navigator is not defined`。Pixi 会在模块求值阶段读取默认浏览器适配器，先前的 `DOMAdapter.set` 执行过晚。共享入口调用 `src/framework/ui/loadHud.ts` 先补齐缺失的 `navigator`，再延迟初始化 Pixi。在无浏览器全局的 VM 环境复现并验证了启动顺序。
- 真机日志显示 Pixi 调度器依赖 `performance.now()`。构建将 Pixi 使用的裸 `performance` 引用绑定到 `globalThis.performance`。启动时保留现有计时器，缺失时将微信原生时钟换算为毫秒，或使用单调递进的本地时间差。新包启动标记为 `[PixiHUD] clock-bridge-v2 function`。
- 模型输入沿用 `WechatGamePlatform` 的原生订阅。HUD 仅在手势起点命中控件时接管该手势。自动回归使用真实 OrbitControls 验证了挂载 HUD 前后场景拖动都能改变相机，也覆盖了 HUD 按下、释放、拖出和取消。
- 用户确认真机预览可以点击。开发者工具 Stable 1.06.2402030、基础库 3.17.6 的临时探针确认 iPhone 模拟模式把鼠标点按和拖动送入 `wx.onTouchStart/Move/End`。同一业务 bundle 在干净窗口中通过按钮计数、拖出释放和模型拖动。原项目旧窗口仍不响应，调试器此前显示异常。关闭原项目窗口并重新打开同一目录后，原工程复测按钮从 `+0` 到 `+1`，拖动改变相机视角。故障定位到旧模拟器会话，工具内部失效机制尚未确认。这次排查仅更新文档，无业务代码变更。
- `npm run build:model` 保留原 GLB／Draco 加载路径，同时挂载 Pixi HUD，是模型与 UI 的联合验收入口。两个构建命令写入同一产物路径。HTTPS 大模型冷缓存、设备兼容范围和滚轮支持仍待验证。
- Pixi 操作覆盖计数、开关、滑块、遮罩和整板拖动。此前首页与模型联合构建和 WebGL2 专项已获开发者确认。本轮 21 项自动回归和九种构建通过本地验证。
- `npm.cmd run build:app:model` 提供配装台和真实模型入口，支持下载取消、失败重试、缓存失效和退出释放。
- `build:webgl2` 和 `build:webgl2:model` 分别验证立方体和模型的 WebGL2 组合。业务模式继续使用 WebGL1。
- `build:ui` 使用包内 PNG 验证 Sprite 和 BitmapText。开发者已确认 `Intl` 修复通过真机验收。当前磁盘产物为 `build:app`，配装台用同一张图集绘制 `01`–`03` 色块，已获开发者验收。图片失败时保留矢量色块和交互。[配装台验收](ARCHITECTURE_AND_USAGE.md#34-框架内部拆分验收)
- 源码按 `src/framework/`、`src/game/apps/` 和 `src/game/common/` 归属。配装台与颜色匹配可独立运行，也可在 `showcase` 中进入。已在只保留必要公共模块的隔离工程验证新增应用流程，当前构建待开发者开展微信端回归。[目录与接入规则](FRAMEWORK_ARCHITECTURE.md#2-模块划分)

### 既有模型基线

- 微信入口 `game.js` 加载 `dist/game.bundle.js`。`npm run build:model` 构建 `src/game/apps/model-viewer/main.ts`，它使用 `src/game/common/model-viewer/LittlestTokyo.ts`。该目标使用 `three-platformize@1.133.3` 的微信适配、WebGL1 和 PixiJS。
- 模型模式依赖远程 Draco GLB。模型通过微信下载与文件 API 读入内存，由适配版 `GLTFLoader` 和静态打包的纯 JS Draco 解码器完成解析，再应用 Toon 材质并播放第一段动画。
- 上次会话确认模拟器恢复显示，手机扫码后开启「开发者调试」可加载模型。下一道验收是手机关闭开发者调试后，使用已登记的 HTTPS 下载域名完成无缓存普通预览。这个条件仍待实测。
- 本轮基于 `e709c0f`（`v1 架构`），初始提交为 `359a5aa`（`init`）。旧 JS 入口与试验可从 Git 查阅，本轮变更尚在工作区。
- 最小构建现有 TypeScript 入口和 Pixi 面板，能够脱离模型资源服务器独立运行。普通扫码及公网资源仍按 §7.4 做发布验收。

## 2. 框架方案评审

### 2.1 原型阶段的能力差距

以下保留框架实施前的评审和临时构建测量，最新状态见 §1 与架构指南。

| 能力 | 当前证据 | 首版要求 |
| --- | --- | --- |
| TypeScript 开发 | 网页原型和同级适配示例使用 TypeScript，小游戏主入口为 `src/three-test.js`，小游戏工程没有 TypeScript 或微信小游戏类型依赖。 | 在框架入口及新增应用模块启用严格型检，统一用锁定的依赖和脚本构建。 |
| 微信开发者工具运行 | `game.js → dist/game.bundle.js` 已跑通过。Littlest Tokyo 冷启动依赖局域网模型服务。 | 导入同一目录，使用代码生成的场景验证首屏和 UI。Littlest Tokyo 保留为 Draco、纹理、动画和微信资源链路的独立回归样本。 |
| Three.js 3D | 已验证 `three-platformize@1.133.3` 的 WebGL1 路径。 | 优先在这一基线上完成 TypeScript 和 UI 集成。将平台注册和渲染后端封装在实现边界，为后续引擎升级保留切换点。 |
| PixiJS UI | 安装了 `pixi.js@8.23.0`，网页原型用 DOM 叠加第二张 Canvas，当前小游戏 bundle 未包含 Pixi。 | 在小游戏同屏绘制计数按钮或状态面板，点击时状态可见更新，按钮外仍可操作 3D。确认渲染、触摸和尺寸变化都能工作后再确定首版 UI 后端。 |

框架实施前曾以内存中的临时 TypeScript 入口引用现有 3D 入口及 Pixi 的 `WebGLRenderer`、`Container`、`Graphics`、`Text` 和 `DOMAdapter`，沿用当前 esbuild 设置打包。结果通过 ES2019 语法解析，未计资源的原始 JS 为 1,769,520 字节，比当前主 bundle 多 504,033 字节。这个结果只覆盖转译、依赖打包和语法，TypeScript 正式型检、微信启动、Pixi 渲染与触控仍需验收。

### 2.2 首版架构设计记录

下列设计用于解释首版取舍。当前实现和验证范围见 §3 与 §6。

1. **保留现有打包入口，给 TypeScript 建立类型检查。** 继续用 `game.js` 加载 ES2019 IIFE。引入 `typescript` 与微信维护的 `minigame-api-typings`，配置 `strict` 与 `noEmit`，让 `npm run build` 先执行 `tsc --noEmit`，再由 esbuild 从 TypeScript 入口产出原路径的 JS。先迁移首屏入口及与它相连的模块，保留生成的 Draco 解码器 JS。当前 GLTFLoader 声明要求完整 `DRACOLoader`，实际分支调用 `decodeDracoFile`，需要在连接处收敛为一个明确的类型适配边界。Three.js 和 Pixi 的声明仍可能引用 DOM 类型，类型可见性与真机 API 可用性分别验证。[esbuild TypeScript 说明](https://esbuild.github.io/content-types/#typescript) · [微信小游戏 TypeScript 类型定义](https://github.com/wechat-miniprogram/minigame-api-typings)
2. **单画布、单主循环，先验证共享 WebGL。** 启动模块创建唯一的上屏 Canvas、初始化平台与 Three 渲染器，并把同一 Canvas 与 WebGL 上下文交给 Pixi。每帧由同一处更新和调度 Three、Pixi，按 Three 后 Pixi 的顺序绘制。渲染器切换时各自重置 GL 状态，Pixi 关闭清屏，尺寸、DPR 和上下文生命周期由启动模块协调。网页原型的双 Canvas 叠层不能直接移植到小游戏。共享上下文是优先验证方案，指南只提供了集成方法，当前微信 WebGL1 组合仍需实测。[PixiJS 的 Three.js 混合渲染指南](https://pixijs.com/8.x/guides/third-party/mixing-three-and-pixi) · [腾讯云小游戏画布说明](https://intl.cloud.tencent.com/zh/document/product/1219/68063)
3. **把 Pixi 环境和输入验证做成两步。** 先运行 Pixi 的最小图形和文本，使用定向 `DOMAdapter` 适配画布、图片及必要能力。锁定版本的共享上下文初始化依赖 WebGL 构造器判别，Canvas 还须支持上下文事件监听。再做点击和手势分流。Pixi 的 `EventSystem` 还直接访问 `globalThis.document`、`navigator` 和全局事件监听，Three 平台适配又已经自动转发 `wx.onTouch*`。优先用单一输入入口按逻辑坐标命中 UI，再把其余手势交给 3D 适配。触点从按下到结束应维持所属目标。若完整 Pixi 事件桥在首轮受阻，可用手动命中验证一个 Pixi 按钮，同时把通用 Pixi 事件适配保留为待验项。[PixiJS 自定义运行环境](https://pixijs.com/8.x/guides/concepts/environments)
4. **保持少量清晰的模块边界。** 建议将启动与帧循环、微信平台能力、3D 场景、HUD 以及已有资源与解码分别归属具体模块。HUD 读取界面状态并发出按钮动作，场景负责模型渲染、相机和动画。暂以可替换的模块接口承载 UI 试验，公用组件、场景管理器、浏览器双目标或额外构建工具由实际需求驱动。

### 2.3 备选方案及切换条件

| 方案 | 适用条件和取舍 |
| --- | --- |
| **Three + Pixi 共享 WebGL** | 建议优先验证。适合后续需要 Pixi 场景树及丰富 UI 的框架，避免把独立 UI Canvas 逐帧上传为纹理。需通过 WebGL1、画布状态、两引擎状态重置和输入路由验收。 |
| **离屏 Canvas 2D + Three 纹理 HUD** | 共享 WebGL 遇到目标机的上下文或状态兼容问题时，先验证这一条。适合少量按钮、进度和文字，可以用微信离屏 Canvas 2D 绘制，界面变化时更新纹理，再由 Three 绘制到上屏 Canvas。若仍要保留 Pixi 场景树，可另行验证锁定版本的 Pixi CanvasRenderer 及其功能子集。两种方式都要实测离屏 Canvas 作为纹理源的兼容性，以及上传带宽和分辨率。简单 HUD 成功只代表 UI 降级可用。 |
| **升级现代 Three.js** | 适合明确需要新渲染特性且允许提高设备门槛的阶段。官方 `WebGLRenderer` 自 r163 起要求 WebGL2。升级之前先做目标微信设备的 WebGL2、平台适配、GLB 纹理和 Draco 验收，避免与首版 TypeScript 和 Pixi 变更同时发生。[Three.js WebGLRenderer 文档](https://threejs.org/docs/pages/WebGLRenderer) |

现有 esbuild 已能生成微信工具可用的包，增加类型检查即可开始迁移。Vite 可继续服务现有网页原型。若未来硬性目标转向可视化编辑器、内置 UI 和一键发布，再评估 Cocos 等完整引擎，这会改变当前以 Three.js 为核心的技术栈。[Cocos Creator 微信小游戏构建说明](https://docs.cocos.com/creator/3.5/zh/editor/publish/publish-wechatgame.html)

## 3. 模型回归架构和依赖

```text
微信小游戏运行时
  game.js → dist/game.bundle.js ← esbuild ← src/game/apps/model-viewer/main.ts
                  ├─ wx.createCanvas → PLATFORM.set(WechatPlatform)
                  │                   → WebGL1Renderer + OrbitControls → Pixi HUD
                  ├─ LittlestTokyo.ts（带 model 的构建）→ loadModelGLB → 微信下载与文件 API
                  │                   → ArrayBuffer（本地版本缓存或远程下载）
                  ├─ GLTFLoader.parse(ArrayBuffer, '', ...)
                  │       └─ WechatDracoLoader → 静态纯 JS decoder → BufferGeometry
                  └─ applyAnimeToon → Scene → AnimationMixer / RAF 渲染
```

| 路径 | 当前职责和关键依赖 |
| --- | --- |
| `game.js`、`game.json` | 微信加载 bundle，运行方向为竖屏。bundle 启动依赖小游戏的 `wx` 等全局对象。 |
| `project.config.json`、`project.private.config.json` | `compileType: game`，当前基础库配置为 `latest`。公开配置的 AppID 用于导入，私有配置只覆盖项目名。当前 `es6: false`、`minified: true`、`urlCheck: false`。打包忽略 `node_modules`、`src`、`assets`、`.git`、两个 npm 清单文件。源码更新后须重新生成 bundle。 |
| `package.json`、`package-lock.json` | esbuild 锁定 0.28.2，构建参数固定为浏览器平台、IIFE、压缩、ES2019，并将 `fs` 和 `path` 标为外部模块。运行依赖锁定 `three-platformize@1.133.3` 和 `pixi.js@8.23.0`。已移除旧实验遗留的独立 `three`、`draco3d` 和 Git 适配包。 |
| `scripts/targets.json`、`src/game/apps/model-viewer/main.ts` | 构建选择单个应用入口，由入口组装模型及公共 HUD 后调用共享运行时。 |
| `src/framework/runtime/startGame.ts` | 创建 Canvas、平台和渲染器，调度相机、场景更新及 HUD，处理尺寸和前后台。DPR 上限 2，动画步长上限 0.05 秒。 |
| `src/game/common/three/Cube.ts` | 无外部资源的几何回归场景。 |
| `src/game/common/model-viewer/LittlestTokyo.ts` | 配置模型相机、灯光、sRGB 和 ACES。异步加载 GLB，位置 `(1, 1, 0)`，缩放 `0.01`，默认播放首段动画。通过 `update(delta)` 将 Mixer 接入共享帧循环。 |
| `node_modules/three-platformize/src/WechatGamePlatform/index.js` | 为库提供 Canvas、最小 DOM、图片、Blob/URL、XHR 等适配。内部绑定 `wx.onTouchStart/Move/End`，向 Canvas 派发触摸和部分指针事件。GLB 内嵌纹理也依赖该平台的图片和 Blob/URL 路径。应用层应复用该事件桥接，避免重复转发。 |
| `src/game/common/model-viewer/modelAsset.ts`、`src/framework/assets/model/` | 场景指定 URL、缓存键和版本。加载器优先读微信持久缓存，校验 ArrayBuffer、GLB 头和声明长度，下载须 HTTP 200。解析桥把 Draco 拒绝传入失败回调。GLB 解析通过后才持久化，复制失败只告警，继续展示本次模型。 |
| `src/framework/assets/model/draco/WechatDracoLoader.js`、`src/framework/assets/model/draco/draco_decoder.js` | 解码工厂随主包静态导入，首次解码时初始化实例级 Promise。适配版 GLTFLoader 以 `decodeDracoFile(buffer, callback, attributeIDs, attributeTypes)` 调用。实现按 Draco unique ID 读顶点属性，支持 mesh 和 point cloud 分支，mesh 按顶点数选择 16/32 位索引，有 position 时计算包围盒和包围球，并释放解码器、解码缓冲、几何对象和临时数组。当前顶点属性统一输出 Float32，`attributeTypes` 仅作为接口参数传递。 |
| `src/game/common/model-viewer/AnimeToonMaterial.js` | 把 MeshStandardMaterial 转成 MeshToonMaterial，支持材质数组，保留基础色、贴图、透明、顶点色及深度等关键设置。用共享 5×1、最近邻过滤、无 mipmap 的 `LuminanceFormat` 渐变纹理。Mesh 上设置投射和接收阴影，主场景的阴影开关目前未配置。 |

当前资源配置在 `src/game/common/model-viewer/modelAsset.ts` 的 `littlestTokyoAsset`。URL 为 `http://192.168.1.46:8080/model.glb`，`cacheKey` 为 `littlest-tokyo`，`version` 为 `network-test-v3`。默认缓存文件名为 `littlest-tokyo-network-test-v3.glb`。当前样本是自包含 GLB，解析参数的基础路径为空字符串。将来换成带外链纹理或缓冲区的资源时，需要明确相对路径如何解析与下载。

## 4. 从网页到小游戏的方案演进

| 阶段 | 交接依据 |
| --- | --- |
| 浏览器原型 | 同级 `../littlest-tokyo-vite` 的 `src/main.ts` 是 Littlest Tokyo 网页实现。Three.js 0.180、Vite、TypeScript、浏览器 DOM Canvas、官方 GLTFLoader/DRACOLoader、OrbitControls、Sky/PMREM、Toon 材质与动画。另有第二个 Canvas 上的 Pixi 测试按钮。原型可用 `npm run assets` 准备模型和解码资源，再用 `npm run dev` 启动。 |
| 微信早期实验 | Git 中的旧 `src/pixi-test.js` 记录现代 Three.js、手动 Canvas 和环境补丁、`MiniProgramDRACOLoader`、包内 `assets/model.glb`、`libs/draco` WASM 文件及 wrapper。文件名里的 Pixi 对应早期试验命名，这个脚本本身主要做 3D 加载、相机适配与动画。 |
| 平台与解码试验 | 同级 `../three-platformize-demo-wechat-game` 是适配参考。`src/draco-test.js` 用文本 loader 和 `new Function` 验证工厂，`src/draco-static-test.js` 检查静态导入。两者及试验 bundle 已移除，可在 Git 历史查阅。 |
| 当前小游戏入口 | 使用同一套 `three-platformize` 核心、GLTFLoader、OrbitControls 和几何类型，通过 `WechatGamePlatform` 适配 WebGL1。解码采用静态纯 JS、主线程执行，运行链路无需 Worker、WASM decoder 或动态执行解码源码。GLB 从包内转为局域网下载和微信持久缓存。保留模型变换、动画、Toon 和基本轨道相机，小游戏已接入 Pixi HUD，Sky 与 PMREM 仍待移植决策。 |

这条演进根据保留的网页原型、Git 基线、试验文件及现有入口重建。早期实验的完整时间顺序缺少连续 Git 提交记录。

## 5. 上次空白问题与现有修复

| 故障环节 | 上次记录与当前落点 |
| --- | --- |
| 模拟器接入缓存后仍空白 | 当时 `CONFIG.maxPixelRatio` 缺失，`Math.min` 得到 `NaN`，使画布尺寸失效。当时已出现 Draco 网格解码日志。现有共享入口保留 DPR 上限 2。缓存版本改变会切换缓存文件并可能触发网络下载。 |
| 材质纹理上传 | 历史实现的 `RedFormat` 在当前 WebGL1 环境报 `texImage2D: invalid internalformat`。现有 `AnimeToonMaterial.js` 已改为 `LuminanceFormat`。 |
| 开发者工具完整重编译 | 当时工具再次转换了 esbuild 产物，启动时报 Babel 辅助模块缺失。现有项目设置 `es6: false`。 |
| 点击预览时打包失败 | 旧 ES2020 bundle 残留 `?.` 和 `??`，预览压缩器首先在 `onProgress?.(...)` 附近报错。构建现在固定 `--target=es2019`，由 esbuild 转换这些语法。 |
| 预览包生成后手机模型未加载 | 上次用户观察到局域网 HTTP 在手机开启「开发者调试」后可加载。现象与微信的下载域名检查吻合。没有服务器 GET 还可能是命中缓存、局域网不通或请求前被拦截，须结合手机端下载/缓存日志和冷启动验证。当前 URL 仍是私网 HTTP，正式口径需以 HTTPS 登记域名和关闭调试的实测为准。[腾讯云小程序平台网络指南](https://main.qcloudimg.com/raw/document/product/pdf/1593_91178_cn.pdf) · [腾讯云小游戏网络说明](https://staticintl.cloudcachetci.com/doc/pdf/product/tencent-cloud_1219_60585_zh.pdf) |

历史 JS 入口的修复由共享运行时及 `src/game/common/model-viewer/LittlestTokyo.ts` 继承。Pixi 初始化和输入的故障也已收录。[QA 文档](QA.md)

## 6. 验证状态

| 状态 | 证据或待验项 |
| --- | --- |
| 本轮本地通过：构建与产物 | 21 项自动回归及九个实际构建通过，产物依赖和素材清单逐目标核对，bundle 均通过 ES2019 解析。当前 `build:app` 的 JS 为 1,105,898 字节，图集为 402 字节。[完整尺寸](ARCHITECTURE_AND_USAGE.md#1-当前基线) |
| 本轮单应用接入验证 | 在隔离工程只增加应用的入口、HUD 和一条目标映射。保留或删除无关应用均能构建，未引用的公共模块和图片未进入产物。软件 WebGL 验证立方体和自定义 Pixi HUD 同屏。 |
| 目录重构与颜色匹配本地通过 | 软件 WebGL 使用模拟微信输入，验证配装台、颜色匹配、后台计时暂停、重开和重进。真实 GLB 的本地联调覆盖取消、503 重试、缓存和销毁。当前构建仍需微信工具和目标手机复测。 |
| Pixi UI 诊断及配装台通过开发者验收 | 原 Pixi UI 诊断包的 `Intl` 修复已有真机通过反馈，`build:app` 的配装台新增 UI 也获开发者确认。首次读取、重进复用和图集加载失败由桌面软件 WebGL 单独验证。配装台验收未附机型、基础库和包分析。 |
| 本轮离线通过：模型链路 | 两份 Littlest Tokyo GLB 内容一致。使用真实 4,133,072 字节 GLB、真实加载及解码模块和模拟的微信下载、文件与图片接口，跑通冷加载及缓存命中，均得到 71 个网格、193,125 个顶点及动画 `Take 001`。图像接口覆盖到加载回调，实际 GPU 贴图显示由工具和真机复测。 |
| 此前模拟器与 UI | 修复后工具可显示模型、材质与动画。同一 bundle 重开工具会话后输入恢复。计数、开关、滑块、遮罩及整板拖动已获开发者验证。 |
| 上次用户验证通过：调试手机预览 | 手机开启「开发者调试」后可加载。设备型号、微信版本、基础库版本以及冷缓存/热缓存的完整测试记录待补。 |
| 待验：无调试普通预览 | 使用已登记的 HTTPS 下载域名及新缓存版本完成普通扫码冷、热缓存，记录目标设备和环境。 |
| 待验：统一入口的新包 | 由开发者复测模型、动画与 UI、窗口尺寸变化、前后台恢复、双指缩放与长时间运行。最低基础库与 iOS/Android 支持范围仍待确定。 |
| 待验：其他素材与 UI | 点云、32 位索引、整数/归一化属性、其他模型。Pixi Text、BitmapText、Sprite、滚动和列表分别验收，阴影和 Sky/PMREM 按需求推进。 |

## 7. 模型演示构建、运行与真机预览

以下使用 PowerShell。首次在干净目录用 `npm.cmd ci` 安装锁定的依赖。安装可使用 npm 源或完整缓存。

### 7.1 准备并启动资源服务器

```powershell
Set-Location 'D:\Project\Web\ThreeJsTest'
Get-Item '.\WechatAssetServer\model.glb'
ipconfig
python -m http.server 8080 --bind 0.0.0.0 --directory '.\WechatAssetServer'
```

保持资源服务器终端运行，`Ctrl+C` 可停止。`WechatAssetServer` 是同级静态文件目录。若文件缺失，可从 `littlest-tokyo-vite/public/models/LittlestTokyo.glb` 复制为该目录的 `model.glb`。网页副本也缺失时，在 `littlest-tokyo-vite` 安装依赖并执行 `npm.cmd run assets`，该脚本从上游下载资源。

另开终端执行以下命令，验证 HTTP 200 及当前模型长度。随后用同一 Wi-Fi 的手机访问同一 URL，排除 Windows 入站防火墙、访客 Wi-Fi 隔离、VPN、地址变化或端口冲突。以 `ipconfig` 中手机可达的网卡 IPv4 为准。地址变动时调整资源清单的 `littlestTokyoAsset.url` 并重建。

```powershell
curl.exe --noproxy '*' --connect-timeout 5 -I 'http://192.168.1.46:8080/model.glb'
```

### 7.2 构建与模拟器

```powershell
Set-Location 'D:\Project\Web\ThreeJsTest\PixiWechatTest'
# 仅首次安装依赖或需要恢复锁文件对应的依赖树时执行
npm.cmd ci
npm.cmd run build:model
Get-Item '.\dist\game.bundle.js'
```

1. 在微信开发者工具导入 `PixiWechatTest` 工程根目录，选择小游戏工程并使用有预览权限的账号和项目配置里的 AppID。保留 `game.js`、`game.json`、`dist/game.bundle.js` 的现有路径。
2. 点击「编译」。局域网 HTTP 联调沿用 `urlCheck: false`。如界面出现工具转换或域名相关报错，核对当前项目设置及公开、私有配置的生效值。
3. 在控制台检查 `[ThreeDraco] Starting`、`Renderer initialized`、资源下载/命中日志、`Resource ready`、`[Draco] Decoder initialized`、`GLB parsed`、`[AnimeToon] Converted materials`、`Animation:` 与 `Scene ready`。同时观察模型和动画，日志统计仅能证明到达相应阶段。

### 7.3 手机局域网调试复测

1. 手机与电脑使用互通的 Wi-Fi，确认服务器持续运行。如需验证冷下载，临时换一个从未使用的资源 `version`，只使用字母、数字、下划线和连字符，然后重建。
2. 在开发者工具点击「预览」生成新二维码，用手机微信扫码，在小游戏菜单开启「开发者调试」，按界面提示重进。开发者工具的「真机调试」入口可用于排查，但其测试结果应单独记录。
3. 冷启动需要看到 `[AssetLoader] Download`、服务器收到 `GET /model.glb` 并返回 200、`Download completed` 及最终 `Scene ready`。冷启动后用同样的包重新打开，看到 `Cache hit`、场景恢复且无重复 GET，可作为热缓存验收。需要复测缓存损坏时仅处理对应测试版本的文件。

### 7.4 关闭调试的普通扫码验收

1. 将同一个 GLB 部署到手机可访问、证书有效的 HTTPS 静态服务或 CDN。在微信公众平台为当前小游戏 AppID 登记对应的 `downloadFile` 合法域名，核对下载最终主机及后台生效配置。
2. 切换资源的 `url` 至 HTTPS，并换成全新 `version`，再构建和生成预览二维码。验收时关闭开发者工具的跳过校验设置和手机端「开发者调试」。推荐记录本次的 AppID、有效基础库、微信版本、设备系统及资源版本。
3. 用授权手机普通扫码，记录服务端 200、无缓存下载证据和模型显示及动画。再次打开验证热缓存。至少覆盖目标 iOS 与 Android 各一台，其他设备按发布范围扩展。

### 7.5 按首个错误定位

| 迹象 | 先检查 |
| --- | --- |
| 无 `Starting` 或生成不了二维码 | 项目导入根目录、`game.js` 是否加载新 bundle、预览打包错误、ES2019、`es6: false`。 |
| 有启动日志，缺少 `Renderer initialized` | `wx` 初始化、Canvas、平台注册顺序、窗口和像素比数值、WebGL1 上下文。 |
| 出现底色，下载后无 `Resource ready` | 缓存文件读取、下载失败信息、HTTP 返回状态、合法域名、Wi-Fi、防火墙、GLB 头部和长度。 |
| 有 `Resource ready`，缺少 `GLB parsed` | 查 `Model loading failed` 的首条错误，核对压缩 bufferView、属性与纹理适配。当前桥接会传播 Draco 拒绝，场景尝试有 45 秒限制。 |
| 已有 `Scene ready`，屏幕仍异常 | 相机目标与模型变换、渲染循环、有效绘图尺寸、WebGL 纹理格式与 GL 错误。 |

## 8. 遗留问题和必须保留的实现

- **保留构建与平台顺序。** 微信入口继续指向已生成的 ES2019 bundle。先创建微信 Canvas 并注册 `WechatGamePlatform`，再创建 Renderer 与 Controls。WebGL1 需保留有限 DPI 和兼容的 Toon 渐变格式。升级包、渲染器或构建目标时需重复预览打包与真机验收。
- **保留 GLB 字节链路。** 当前路径是 `wx.downloadFile → wx 文件读取 → GLB 校验 → GLTFLoader.parse → 缓存`。解析失败的缓存尝试删除，当前进程的重试跳过该条缓存。下载在途退出会取消，已开始的解析结果在退出后释放。保留版本隔离与缓存写失败时继续使用内存数据的行为。更换 URL 时同步更新版本，自动淘汰和内容哈希待后续按业务需求评估。
- **保留 Draco 接口与释放。** 同版本的 `three-platformize` GLTFLoader 和几何对象配合使用，保留静态工厂、回调契约、unique ID 映射、索引选择和显式释放。已在本地用损坏的 Draco 片段复现，解码 Promise 拒绝后 GLTFLoader 外层回调无法结算。该分支只接成功回调，需补错误传播、超时、可见失败和重试。解码同步计算仍在主线程，首帧卡顿、峰值内存与释放行为待实测。
- **补齐运行反馈与生命周期。** 模型加载错误和下载进度只进入日志，模型失败后可能只剩背景与 HUD。模型入口和立方体共用前后台暂停、恢复及尺寸监听，最新包待界面复测。阴影当前关闭。
- **保全工作区与产物策略。** `e709c0f` 可回查历史入口和独立试验。本轮确认实际打包依赖后移除旧 JS 脚本、文本解码副本、试验 bundle 和元数据，保留归档 `libs/` 且排除在打包规则外。发布前核对工具包分析和产物模式。

## 9. 推荐任务与验收

首版交付一个可复用的微信小游戏工程。另一位开发者拿到完整源码和锁文件后，可以执行 `npm ci`、`npm run build`，导入工程根目录，在微信开发者工具里看到可操作的 3D 场景及由 Pixi 绘制的按钮。默认演示无需资源服务器。以下任务保留实施步骤与完整验收口径。统一入口和两种构建已落地，新包的界面与设备验证见 §6。

| 任务 | 优先级 | 依赖 | 可交付结果 |
| --- | --- | --- | --- |
| T01 固定当前 3D 回归基线 | P0 | 无 | 可恢复的工作区和旧链路验证记录 |
| T02 接入 TypeScript 构建 | P0 | T01 | 严格型检和可导入的 ES2019 微信包 |
| T03 实现无资源加载的首屏 | P0 | T02 | TypeScript 入口、程序化 3D、单帧循环、可扫码的最小预览包 |
| T04 验证 Pixi 和 Three 同屏 | P0 | T03 | 同画布 3D、Pixi 图形和文字 |
| T05 实现按钮与 3D 手势分流 | P0 | T04 | 可点击 HUD 和真机兼容验证记录 |
| T06 GLB、Draco 与 UI 联合回归 | P0 | T03、T05 | 保留模型、动画与相机，用同屏 HUD 验收 |
| T07 交付可复用工程 | P0 | T05 | README、可复现安装构建和主包验收记录 |
| T08 增强资源错误恢复及生命周期 | P1 | T07 | 可诊断的错误反馈和重试、生命周期回归 |
| T09 验收关闭调试的普通扫码 | 发布 | T07、可用 HTTPS 与后台权限 | 无调试的有效预览记录 |

### T01 · 固定现有 3D 回归基线

1. 保留 `e709c0f` 历史证据和当前工作区差异，保障 `src/main.ts`、`src/game/common/model-viewer/LittlestTokyo.ts`、现有解码器、材质、资源代码及依赖锁可恢复。
2. 用 `npm.cmd run build:model` 重新核对 `game.js → dist/game.bundle.js`。按 §7.1 至 §7.3 复跑模拟器及可用的调试手机预览，记录构建体积、基础库和首个失败阶段。用新测试缓存版本和原版本分别检查冷下载与热缓存。

**验收要求**为可复现当前构建，模拟器看到模型、贴图、Toon 和动画。场景日志预计为 71 个网格、193,125 个顶点、1 段动画。若当次设备或服务器不可用，记录已验证范围及缺失证据，从已确认的构建和离线解码基线继续做 T02。

### T02 · 接入 TypeScript 构建

1. 在 `PixiWechatTest` 增加并锁定 `typescript` 和 `minigame-api-typings`。配置 `tsconfig.json`，对框架源码开启 `strict`，用 `noEmit` 做类型检查。构建先执行 `tsc --noEmit`，成功后由 esbuild 从建议入口 `src/main.ts` 输出 `dist/game.bundle.js`。
2. 保留 `game.js`、ES2019 IIFE 和开发者工具的 `es6: false`。首轮可从 TypeScript 入口调用旧场景验证兼容。对旧 JavaScript 模块采用小范围类型声明或适配，按业务入口迁移。生成的 Draco decoder 继续保留 JavaScript。
3. 用一个临时类型错误验收构建失败，再恢复代码重建。在干净副本按锁文件安装并复测，无用 Git 依赖已经移除。

**验收要求**为 `npm run build` 在 TypeScript 型检失败时返回非零且停止打包。恢复后正常生成 ES2019 产物，开发者工具成功执行 TypeScript 入口的启动逻辑。

### T03 · 实现无资源加载的 Three 首屏

1. 从旧示例提取已验证的 Canvas 初始化顺序、`WechatGamePlatform`、`WebGL1Renderer`、DPR 上限和相机控制。首屏用 TypeScript 直接生成一个有色立方体、相机和灯光，验证渲染、旋转及拖动。整个默认演示不读取 GLB、外部纹理或模型缓存，也不发起资源请求。
2. 建立清晰的三个边界。启动模块持有 Canvas 和 RAF，场景模块持有 3D 对象、相机及控制器，微信平台模块提供 Canvas、窗口尺寸与触控适配。用一次初始化和一处帧调度串起更新与绘制，留出 HUD 绘制位置。
3. 窗口变更时统一更新尺寸、相机和逻辑坐标。用开发者工具的包分析确认默认预览包大小与文件清单。Littlest Tokyo 资源保留在包外，默认模式只加载程序化演示。GLB 加载器和 Draco 工厂由 T06 的模型模式引用。历史试验 bundle 已清理，旧 WASM 归档由打包规则排除。

**验收要求**为关闭局域网资源服务器，构建默认程序化演示。在模拟器确认立方体可见、画面持续更新、相机可操作，切换视口后画幅正确。用同一构建生成普通预览二维码，在可用的授权手机上关闭开发者调试扫码并复现。首次打开与再次进入均无模型下载请求，也无需操作旧模型缓存。T04 和 T05 沿用这个场景验收 Pixi 同屏和触控。无法生成二维码时记录工具报错及实际预览包文件清单。

### T04 · 验证 PixiJS 和 Three 共享画布

1. 使用项目已锁定的 Pixi 版本，先编写最小 HUD 模块，只画一个有色按钮背景和一行计数文本。先验证环境适配与渲染初始化，再引入事件处理。
2. 按 §2.2 复用 Three 所用的上屏 Canvas 和 GL 上下文。帧顺序为更新场景、Three 渲染、Pixi 渲染，切换时重置两边状态，Pixi 绘制时保留 Three 的颜色缓冲。由同一模块负责设置尺寸和 DPR。
3. 在开发者工具记录实际 GL 版本、Pixi 首帧表现及第一个报错点。分别检查上下文版本判别、Canvas 事件能力、扩展和状态恢复。若共享路径卡住，记录最小复现，并按 §2.3 验证备选路线。

**验收要求**为同一屏稳定显示运动中的 3D 和 Pixi 图形，无画面交替清屏或持续的 WebGL 错误。现有数字用 Graphics，Text 的字形纹理属于后续专项。若走离屏 Canvas 2D 备选，记录其结果并确认首版 UI 要求。

### T05 · 接上 HUD 点击和 3D 手势

1. 使用逻辑坐标进行 UI 命中测试，由单一输入入口处理事件分流。在触摸开始时确定 UI 或 3D 所有权，持续到结束或取消。复用微信平台已有的触摸桥接能力，梳理现有自动转发和新增输入处理的调用顺序。
2. 增加一个计数按钮。完整 Pixi 事件桥接若需要更多平台兼容工作，可先由微信触控做薄层命中，Pixi 仍负责按钮渲染。处理 `touchcancel`，避免拖出按钮或多指途中错误触发点击。连同尺寸和 DPR 一起验证命中区域。
3. 用代表性 iOS 和 Android 各一台做调试预览。记录机型、微信版本、有效基础库、GL 版本和实际触摸路径。缺少设备时可先完成模拟器验收，设备兼容保持待验。

**验收要求**为点按按钮计数加一且相机不动，拖出或取消不触发，按钮外单指可旋转、双指可缩放。切换模拟器尺寸或 DPR 后，按钮显示位置与命中区域仍一致。

### T06 · 接回现有模型演示并做 Draco 回归

1. 提供独立选择的模型演示构建，复用同一个 TypeScript 框架启动模块。继续复用 `WechatAssetLoader`、`WechatDracoLoader`、适配版 `GLTFLoader` 和 Toon 材质，由模型演示配置指定资源 URL、缓存 key 和版本。
2. 在 GLTFLoader 的类型适配处收敛自定义 Draco 回调契约，保留现有解码工厂、几何属性映射和资源释放。继续保留内存 GLB 校验、缓存写失败时的本次内存加载，以及局域网调试流程。
3. 用新版本冷下载，验证服务器收到 GET。再次进入验证缓存命中；在同屏 HUD 存在时检查贴图、动画及相机。恢复默认为程序化场景后，再验证无服务启动。

**验收要求**为模型模式在模拟器或局域网调试路径复现现有 71 个网格、193,125 个顶点与 1 段动画，冷、热缓存可区分。Littlest Tokyo 为 4,133,072 字节，保持远程提供。若后续需要验证微信普通预览中的 GLB 和 Draco，可优先选一个足够小的代表性 Draco GLB 做专项测试，再按 §7.4 验证远程大模型。模型回归与默认框架的扫码首屏分别验收。

### T07 · 交付可复用工程

1. 将现有模板 README 更新为四段步骤。依赖安装、构建、微信开发者工具导入、运行可选模型演示。说明开发者从哪里加场景、按钮和点击逻辑，记录实际验证环境。
2. 用微信开发者工具的包分析检查主包文件和体积。保留运行入口、动态引用的实际资源和主 bundle，按用途处理试验 bundle、构建元数据、旧 WASM 及文档的打包规则。将生成产物的入库策略记录在 README。
3. 让另一位开发者或使用干净副本从头执行安装、构建和导入。验收记录保存构建结果、画面、交互结果和当时未覆盖的手机范围。

**验收要求**为无本机私网地址和旧缓存前置条件，干净工作区运行两条 npm 命令后，开发者工具能打开可交互的 Three + Pixi 首屏。包分析及实际构建步骤可由接手者重现，模型回归的状态和复现命令单独记录。

### T08 · 增强错误恢复与生命周期

1. 为资源演示添加进度、失败与重试状态。用断网、非 200、坏 GLB 头和坏 Draco 数据验证不同故障，处理 Draco 拒绝导致的 GLTF 等待悬挂。按需要为异步尝试做取消或过期结果丢弃。
2. 验证前后台暂停和恢复、窗口更新及输入取消。多次打开、失败和重试时检查是否产生重复 RAF、监听器或资源占用。
3. 记录代表性设备在程序化场景和模型场景下的首屏、模型加载阶段耗时、帧率和内存，基于实测再制定性能门槛。

**验收要求**为失败有可见反馈，重试可恢复，前后台切换后场景和 HUD 正常。记录能指出失败阶段及设备环境。

### T09 · 验证远程资源在普通扫码下的表现

1. 在有 HTTPS 托管和 AppID 后台权限时，按 §7.4 登记合法下载域名，切换模型模式的 URL 和测试缓存版本，生成新二维码。
2. 在目标手机关闭开发者调试，记录冷下载的服务端 200、模型可见、动画播放及 UI 可点击。再次打开记录缓存命中。记录线上 URL、资源版本和测试设备。

**验收要求**为目标 iOS 与 Android 在关闭调试时通过模型演示冷启动与热缓存。默认程序化场景仍可独立运行。

Sky/PMREM、完整 UI 组件库、玩法和现代 Three.js 升级在框架首版验收后再按需求立项。

## 10. 需要项目方确认的决策

1. **正式目标。** 确认具体要发布的应用入口与使用的 AppID，并按实际资源列出目标清单。
2. **兼容范围。** 确认 iOS、Android 代表机型与最低微信基础库。用当前 WebGL1 业务包和 WebGL2 专项分别记录支持情况。
3. **产物和发布。** 建议把 `npm run build` 作为生成入口，是否继续跟踪 `dist/game.bundle.js` 由仓库分发方式决定。需要关闭调试的普通扫码交付时，再确认 HTTPS 托管与 AppID 域名配置负责人。
