# 微信小游戏 QA 与故障处理记录

核对日期为 2026-11-20。证据来自当前源码、Git 历史、本地检查、此前开发者工具复测及开发者反馈。每项的验证范围单独记录。架构、操作命令和剩余任务见[架构与使用指南](ARCHITECTURE_AND_USAGE.md)及[开发交接](PROJECT_STATUS_AND_AGENT_HANDOFF.md)。

## 1. 如何选构建和记录结果

| 要验证的内容 | 使用的构建 | 通过条件 |
| --- | --- | --- |
| 启动、画布、共享 WebGL 及基础 HUD 隔离排错 | `npm.cmd run build` | 停止资源服务器后仍能启动，看到旋转立方体和 HUD。 |
| 3D 模型与 UI 联合验收 | `npm.cmd run build:model` | Littlest Tokyo、Toon 材质和动画可见，Pixi 面板可点按、释放、调整和拖动，模型视角仍可操作。 |
| 配装台图集与交互 | `npm.cmd run build:app` | 首入显示 `01`–`03` 三块配色，选色和确认正常，返回重进复用图集。图集出错时矢量色块仍可用。 |
| 业务首页与模型往返 | `npm.cmd run build:app:model` | 首页可进配装台或模型，加载中可返回，失败可重试，回首页后色调和交互正确。 |
| WebGL2 专项 | `npm.cmd run build:webgl2`，随后 `npm.cmd run build:webgl2:model` | 原生绘制、Three、Pixi 各阶段通过，再验证模型、贴图、Toon、遮罩及生命周期。 |
| Pixi UI 专项 | `npm.cmd run build:ui` | 四色 Sprite、六位 BitmapText 和立方体同屏。释放加号更新计数，拖出后释放保持原值。 |
| 发版环境 | 同一模型构建，配置已登记的 HTTPS 下载地址和新缓存版本 | 手机关闭开发者调试后可普通扫码冷下载，二次进入命中缓存，模型动画和 UI 均正常。 |

构建命令从同一个 TypeScript 入口生成同路径 bundle。切换后重新编译。手机测试用新预览码，记录构建模式或 bundle SHA-256，避免把旧二维码对应的错误当成新构建结果。此前 Agent 自动生成普通预览码的请求被审批拦截，开发者选择本地验证，后续设备结果由开发者自行操作并反馈。

## 2. 画布、GLB 与 Draco

| 编号 | 现象与证据 | 处理和当前状态 |
| --- | --- | --- |
| QA-01 | 网页版的标准 DOM、第二张上屏 Canvas、现代 Three.js 官方 Draco Worker 路径依赖浏览器环境。微信早期曾试用手动环境补丁、`MiniProgramDRACOLoader`、包内 GLB 和 WASM wrapper。 | 微信使用原生 Canvas 和 `three-platformize` 的 WebGL1 适配。Three 渲染之后在同一上下文绘制 Pixi。旧实验及浏览器原型的双画布、Sky/PMREM 属于历史路径。 |
| QA-02 | 为确认 Draco 工厂能否启动，历史上有文本 loader 加 `new Function` 的实验，以及静态导入的小脚本。 | 已验证模型使用随包静态构建的纯 JS decoder，通过 `WechatDracoLoader.decodeDracoFile` 接入 GLTFLoader。继续保留 unique ID 属性映射、索引选择和显式释放。小游戏日志中其他组件的 Worker 初始化并不能用于判断这一解码路径。 |
| QA-03 | 模拟器有 Draco 网格日志，画面却空白。旧 `CONFIG.maxPixelRatio` 缺失，`Math.min()` 得到 `NaN`，最终画布尺寸失效。 | `src/main.ts` 统一执行 `Math.min(pixelRatio \|\| 1, 2)`，窗口尺寸、相机和 HUD 使用同一逻辑尺寸。上次修复后模拟器恢复显示。本轮同时用微信小游戏尺寸回调的顶层宽高取值，以系统信息作回退，待界面覆盖尺寸变化。 |
| QA-04 | 旧 Toon 渐变纹理用 `RedFormat`，微信 WebGL1 报 `texImage2D: invalid internalformat`。 | 保留 `AnimeToonMaterial.js` 的单通道 `LuminanceFormat` 渐变和贴图转换。既有模型画面经模拟器和开发者调试验证。 |
| QA-05 | Littlest Tokyo 为 4,133,072 字节，随预览包分发会增加主包体积。此前把无资源立方体跑通当成 UI 联合验证，漏掉了原模型链路。 | GLB 放在同级资源服务器，由微信下载和版本缓存。立方体用于排错，验收 UI 时应同时保留原模型、动画和 OrbitControls，用模型构建补跑。开发者已确认旧基线的控件操作，统一入口后的新 bundle 待手动复测。 |
| QA-06 | 普通扫码后可见背景或 HUD 但无模型，服务器可能也无 GET。此前手机在开启开发者调试后可加载局域网 HTTP 模型。 | 先看 `Cache hit` 和 `Download`，再查 HTTP、Wi-Fi、防火墙和域名配置。改资源清单的 `version` 验证冷下载，同一版本复测热缓存。开发者调试下的 LAN 结果已观察，关闭调试的 HTTPS 冷／热缓存待验。 |
| QA-07 | 下载返回非 200、截断、错误 magic／版本或长度可能造成空白。缓存损坏重进也可能反复失败。 | 资源加载器要求 HTTP 200、ArrayBuffer、GLB 2 头和一致长度。下载内容在解析成功后才持久化，缓存头损坏尝试删除后重下。缓存写失败继续使用本次模型。URL 换源应同步换版本。 |
| QA-08 | 合法 GLB 容器内故意破坏 Draco 片段，本地解码 Promise 拒绝，旧 `GLTFLoader.parse` 完成和失败回调都未触发。 | 已修复并通过真实 GLTFLoader／Draco 的损坏数据回归。Draco 拒绝主动通知外层，损坏缓存尝试删除，当前会话的下一次重试会跳过该条旧缓存。联合构建提供加载状态、失败重试和返回。原生下载超时 30 秒，场景加载限制 45 秒。 |

原空白复现记录可查 Codex 会话「排查微信小游戏预览空白」（`01a1f793-5c43-7872-a533-da1207ecbb0d`）。模型成功路径的参考日志为 `Resource ready` → `GLB parsed` → `Scene ready`。本轮使用真实 GLB、加载器和解码器，以及模拟的微信下载、文件和图片接口，冷、热加载都得到 71 个网格、193,125 个顶点和动画 `Take 001`。真实网络、GPU 贴图和手机端缓存属于手动验收。

## 3. 构建、Pixi 初始化与手机首屏

| 编号 | 现象与证据 | 处理和当前状态 |
| --- | --- | --- |
| QA-09 | 微信工具全量编译再次转译 esbuild 产物，出现 Babel 辅助模块缺失。 | `project.config.json` 保持 `es6: false`，语法转换由 esbuild 负责。 |
| QA-10 | 旧 ES2020 输出残留 `?.` 与 `??`，预览压缩器在 `onProgress?.(...)` 一带报错。 | 两种构建共用 `--target=es2019`。当前两份产物已通过 ES2019 语法解析，微信预览打包按设备流程复测。 |
| QA-11 | 真机基础库 3.17.6 启动报 `ReferenceError: navigator is not defined`，堆栈位于 Pixi 默认浏览器适配器的读取点。 | `loadHud.ts` 补齐缺失的 `navigator` 后延迟导入 Pixi。无浏览器全局的本地测试已覆盖。 |
| QA-12 | 真机模型可见、蓝色 UI 按钮缺失，首条为 `[ThreeDraco] HUD initialization failed`，堆栈指向 Pixi 调度器的 `performance is not defined`。 | 在导入前保留可用计时器或补 `globalThis.performance.now()`，微信性能时钟微秒转换为毫秒，缺失时使用单调的本地时间差。仅增加全局 shim 后曾仍出错，构建随后将 Pixi 的裸引用映射到 `globalThis.performance`。开发者后续确认真机可点击，本地测试验证缺少自由变量绑定的运行环境。 |
| QA-13 | 小游戏平台限制动态代码生成。Pixi 尝试运行浏览器侧动态生成的代码会阻断 HUD 初始化。 | 使用 Pixi 的 `pixi.js/unsafe-eval` 静态兼容模块，提供预定义函数。保留延迟加载和渲染状态切换，初始化或逐帧绘制失败时模型模式记录 HUD 错误并继续 3D。 |
| QA-14 | 模拟器的 Graphics 正常，Pixi `Text` 字形纹理曾为空白。 | 计数和滑块数字用矢量 Graphics。原生 Text、BitmapText、字体与 Sprite 纹理分别作为待验能力，先做独立最小样本。 |
| QA-15 | 模型与立方体以前各有启动入口，模型为 JS，尺寸和前后台处理易出现差异。历史锁文件还有旧试验的 Git+SSH 依赖。 | `src/main.ts` 统一渲染、输入安装、尺寸和 RAF，构建期 `MODEL_DEMO` 选择场景。依赖图确认独立实验未引用后移除旧脚本、对应构建产物和无用依赖。正常 JS Draco 工厂仍在模型包内。最新前后台行为待开发者复测。 |

## 4. 点击、释放、拖动和模拟器异常

| 编号 | 现象与证据 | 处理和当前状态 |
| --- | --- | --- |
| QA-16 | UI 接入阶段曾出现点击、拖动一起失灵，初期试过额外的鼠标／DOM 事件桥。 | 恢复 `WechatGamePlatform` 原生触摸桥。按下时决定手势归属，HUD 命中时持续捕获，拖出按钮后释放或取消不会加一，拖动把手和滑块仍可接收越界位置。未被 HUD 捕获的手势交还给 OrbitControls。自动回归覆盖挂 HUD 前后模型旋转，以及 UI 释放、拖出、取消和持续拖动。 |
| QA-17 | 真机可点击、开发者工具所有输入失灵。Stable 1.06.2402030、基础库 3.17.6 的 iPhone 模拟器探针观察到鼠标点按和拖动经 `wx.onTouchStart/Move/End` 到达，未观察到被探测的鼠标订阅与 DOM 指针回调。 | 同一业务 bundle 在干净项目窗口通过按钮、拖出和模型拖动，原窗口关闭并重开后恢复，期间未改业务代码。已将故障范围缩到旧工具会话，工具内部原因未确定。复发时记录环境和首条日志，先重开项目，再做与同一 bundle 的对照。 |
| QA-18 | 历史模型能拖动，开发者工具鼠标滚轮缩放未通过。 | 当前微信输入适配以触摸为主，滚轮仍未验收。真机单指转动和点按有历史反馈，双指缩放、触点取消和前后台组合需按设备矩阵记录。 |
| QA-19 | 需要系统验证 Pixi 的可用能力和相机输入隔离。 | 扩展为计数按钮、开关、滑块、遮罩和整板拖动演示。顶部双线把手拖动面板，蓝色 `+` 按钮在有效释放时计数。开发者已确认此前操作通过，记录未附完整设备矩阵。新增 Text、Sprite、滚动或列表时逐项验收。 |
| QA-20 | Pixi UI 真机仍显示立方体，但 HUD 弹窗报告 `ReferenceError: Intl is not defined`。Pixi 8.23 的 BitmapText 依赖在模块求值时读取 `Intl?.Segmenter`。 | 构建使用 `--define:Intl=globalThis.Intl`，让缺失 `Intl` 的宿主走 Pixi 自带的 Unicode 码点回退，原生 Segmenter 继续使用。删除 `Intl` 的 VM 中复现旧报错，修复后能进入渲染器初始化。无 `Intl` 的桌面软件 WebGL 已复测图片、数字及点击画面变化。开发者于 2026-11-23 确认真机复测通过，设备和基础库版本未记录。 |

## 5. 验证分工与最短复测

目标架构阶段 A 将共享启动移入 `src/runtime/startGame.ts`。新增回归验证 HUD 异步加载期间 3D 仍绘制，HUD 启用后按 Three、Pixi 顺序输出，切后台后停止帧循环，返回只恢复一个 RAF 且不累计后台时间。该测试使用模拟微信和渲染接口，真机生命周期仍由开发者执行。[框架目标架构与阶段验收](FRAMEWORK_ARCHITECTURE.md)

开发者确认上一阶段验收通过，未提供设备、包分析和耗时细项。框架内部拆分的 `build:app` 已在本地验证首页和配装台往返、选色确认、资源释放以及共用 Canvas 和输入订阅。自动回归覆盖场景初始化异常时保留旧场景，以及复用 RAF。

上一阶段用真实 4.13 MB GLB、Three 场景和 Pixi Graphics，配合模拟微信下载、文件和 GPU，验证联合构建的加载中返回与取消、HTTP 503 后重试、正常模型、退出释放与渲染状态还原，以及热缓存解析中返回后忽略迟到结果。开发者已反馈联合构建验收通过，实际环境细项待补。

WebGL2 探针分别记录原生绘制、Three 和 Pixi 三个阶段。自动测试覆盖缺失上下文、绘制结果错误和共享上下文身份。此前用桌面 Edge 的软件 WebGL2 和模拟微信接口跑通了真实 Draco 模型。开发者已反馈 WebGL2 验证通过，未提供设备、基础库和运行模式细项。[WebGL2 专项步骤](ARCHITECTURE_AND_USAGE.md#36-webgl2-专项诊断)

Pixi UI 诊断验证 `wx.createImage` 包内路径、成功／失败／超时、Pixi 扩展注册顺序及位图数字。桌面 Edge 软件 WebGL 使用真实 PNG 和模拟微信接口，读回了四色 Sprite 像素、六位数字字形和点击后变化的字形。开发者已确认 `Intl` 修复后的诊断包通过真机复测。[Pixi UI 专项](ARCHITECTURE_AND_USAGE.md#37-pixi-ui-专项诊断)

配装台使用同一张包内 PNG，在桌面软件 WebGL 中验证了首页无图片读取、首入只读一次、编号色块显示、选择白边、确认、返回重进和图片失败回退。待使用业务包在微信工具和手机复测，并记录实际包大小。[配装台验收](ARCHITECTURE_AND_USAGE.md#34-框架内部拆分验收)

1. Agent 负责 `npm.cmd test`、构建、产物语法及依赖图检查，报告本轮实际验证范围。开发者负责微信工具的编译及操作、扫码和手机日志。
2. 优先用模型包确认模型及动画同时可见。一次跑完蓝色按钮有效释放及拖出取消、开关、滑块、随面板移动的遮罩、拖动把手、面板外旋转模型。对照[完整 UI 验收表](ARCHITECTURE_AND_USAGE.md#4-ui-验收和扩展)。
3. 改窗口尺寸或切到后台再返回，确认模型继续播放、HUD 命中和显示一致。检查开发者工具两种窗口状态时，保留版本和是否重开恢复。
4. 如真机画面异常，优先回传第一个异常及前一条成功日志。无 HUD 查 `clock-bridge-v2` 和 `HUD initialization failed`／`HUD render failed`，无模型查 `Resource ready`／`GLB parsed`／`Scene ready` 和下载日志，二者均无查 bundle、Canvas 和工具打包阶段。

| 记录项 | 内容 |
| --- | --- |
| 构建 | 命令、提交或 bundle SHA-256、模型资源版本和 URL 类型（LAN／HTTPS） |
| 环境 | 开发者工具、微信客户端和基础库版本，设备或模拟机型，开发者调试开关 |
| 结果 | 测试动作、预期和实际、冷／热缓存、首条相关错误及其前一条成功日志 |
