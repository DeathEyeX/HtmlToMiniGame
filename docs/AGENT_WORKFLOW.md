# AI 业务开发工作流

本文件是 AI 在 PixiWechatTest 中开发业务的入口。适用于新建独立 App、修改既有 App，以及为具体业务补足共享框架能力。命令在 PixiWechatTest 工程根目录运行。

## 1. 确定开发目标

1. 读清需求，确认是新 App、已有 App 修改，还是共享框架问题。确定交付构建目标、可见交互和需要验证的异常路径。
2. 在 [开发归档](development/README.md) 按 App ID、框架模块或错误关键词查记录。核对已试过的方案、相关代码和待验项，再比对当前实现。
3. 查 [目标清单](../scripts/targets.json)，用 `npm.cmd run build:list` 核对入口。涉及公共运行时或发布时，再查 [框架架构](FRAMEWORK_ARCHITECTURE.md)、[架构与使用指南](ARCHITECTURE_AND_USAGE.md) 和 [QA 记录](QA.md) 的相关章节。
4. 选与需求最接近的现有示例。单场景参考 [颜色匹配入口](../src/game/apps/color-match/main.ts)，独立场景加分包资源参考 [海上避难所入口](../src/game/apps/ocean-shelter/main.ts)，应用内多场景切换参考 [Showcase](../src/game/apps/showcase/startGameApp.ts)。

已有 HTML 原型时，可先用 `migrate:html` 生成迁移报告。首帧、HUD 命中区和构建资源也可用对应的本地命令检查。 [本地工具用法](LOCAL_TOOLS.md)

## 2. 按归属装配代码

| 目录 | 归属 |
| --- | --- |
| `src/game/apps/<app-id>/` | App 专属的 TypeScript 入口、场景、镜头、HUD、业务状态和资源路径。 |
| `src/game/common/` | 多个 App 实际复用的业务模块、组件和资源描述。 |
| `src/framework/` | 微信平台适配、共享运行时、渲染、输入和资源读取等通用能力。 |

App 入口与场景切换的装配代码放在 App 根目录。App 自有的 Pixi 视图、布局及 HUD 专属资源代码放在 `hud/`。Three.js 场景、相机、模型及场景专属资源代码放在 `three/`。两侧都用到的业务数据留在同一个 App 内，例如 `ocean-shelter/content.ts`。按实际职责建目录。只装配公共实现的 App 可以只保留入口。 [海上避难所](../src/game/apps/ocean-shelter/main.ts) · [野原家的小屋](../src/game/apps/nohara-house/main.ts)

**新业务走独立目标。** 在 `src/game/apps/<app-id>/main.ts` 调用 `startGame`，并在 `scripts/targets.json` 增加同名目标。运行该目标的产物应直接进入 App 首屏。任务需要集成首页入口时，由 `showcase` 自己装配导航。

**依赖方向为 `apps → common → framework`。** App 可以直接引用框架。禁止跨 App 导入，也禁止公共业务或框架反向引用 App。优先使用现有框架接口，需要补足当前业务所需的共享能力时，再扩展框架。共享改动保留既有调用方式，并为新增行为补回归。

- 场景工厂提供 `camera` 和 `update(delta)`。相机交互可以使用 `controls` 或自定义 `touch(event)`。按需提供 `resize`、`afterRender`、`dispose` 和场景渲染设置。 [运行时接口](../src/framework/runtime/startGame.ts)
- 通过 `startGame` 的 HUD 加载回调延迟引入 Pixi 模块和扩展，保留微信兼容处理的初始化顺序。框架管理一张上屏 Canvas 和一条帧循环，同一帧先绘制 Three.js，再绘制 Pixi HUD。 [HUD 装配](../src/framework/ui/loadHud.ts)
- 触摸开始时由 HUD 或场景接管整段手势。按钮在有效释放时执行，拖动和取消由当前接管者处理。切换场景时，旧场景负责释放自己创建的资源，包括退出后才就绪的异步结果。 [微信触摸分流](../src/framework/platform/WechatPlatform.ts)
- 渲染版本由目标的 `renderer` 配置选择，省略时使用 WebGL1。需要 WebGL2 的能力应在对应目标和设备上验证。 [渲染配置](ARCHITECTURE_AND_USAGE.md#11-入口与渲染配置)

### 代码注释

- Agent 新增或修改代码时，为代码本身看不出的业务规则、平台限制、初始化顺序和资源生命周期补上必要注释。把原因写在相关代码旁，例如「场景可能在模型加载完成前退出，未挂载的模型要在这里释放」。
- 修改 Three.js 场景或模型时，重点核对坐标系和相机约束、影响构图或交互的关键参数、绘制顺序、资源共享和释放。把相关设计原因写在定义或实现旁。例如，剖面房间保留两面固定墙，镜头因此只在开放侧转动。
- 注释沿用模块现有语言和业务术语。能从命名看懂的逻辑直接读代码，去掉逐行转述、模板套话和没有依据的评价。修改逻辑时同步更新受影响的注释。

## 3. 声明主包和运行资源

App 专属素材使用与代码同名的 `media/<app-id>/`。共用文件由实际用到它的目标分别声明。构建保留素材目录内相对路径，GLB 与它引用的外部贴图一起组织。

| 目标字段 | 典型内容 | 构建和读取方式 |
| --- | --- | --- |
| `assets` | 单文件素材，如共用 HUD 图集 | 路径相对于 `media/`，原相对路径复制到 `dist/resources/`。 |
| `packagedResources` | `media/<app-id>/packaged/` 内的启动图标、字形和 HUD | 复制到 `dist/resources/packaged/<目标名>/`，由主包直接提供。 |
| `runtimeResources` | `media/<app-id>/runtime/` 内的场景模型、贴图和环境资源 | 默认复制到 `dist/resources/<目标名>/` 并登记为微信分包。传 `--runtime-url` 时，构建注入 `GAME_RUNTIME_ASSET_URL` 并省略该分包。 |

新 App 通过 [共享资源加载器](../src/framework/assets/createResourceLoader.ts) 的 `loadImage(relativePath)` 和 `readBinary(relativePath)` 读取资源。框架负责分包挂载和远程下载，App 负责把资源交给 Three.js 或 PixiJS、显示加载状态，以及选择失败提示、重试或降级。远程资源服务保持运行目录结构，可以通过版本目录区分内容。 [运行时资源配置](ARCHITECTURE_AND_USAGE.md#运行时资源)

支持远程模式的 App 要读取 `GAME_RUNTIME_ASSET_URL`。有地址时向加载器传入 `{ kind: 'remote', baseUrl }`，默认构建使用 `{ kind: 'subpackage', name, root }`，其中 `name` 是目标名，`root` 是 `dist/resources/<目标名>/`。主包素材继续使用自己的 `package` 来源。 [海上避难所场景资源](../src/game/apps/ocean-shelter/three/assets.ts) · [HUD 主包资源](../src/game/apps/ocean-shelter/hud/assets.ts)

`dist/` 由构建生成，`game.json` 中由目标管理的分包也由构建同步。修改资源归属时，同时核对源路径、目标声明和 App 中的读取路径。

## 4. 本地网页联调

在 `PixiWechatTest/` 运行以下命令。把 `nohara-house` 换成 `build:list` 列出的任意目标。

~~~powershell
npm.cmd run build:list
npm.cmd run dev:web -- nohara-house
~~~

1. 打开终端打印的本地地址。浏览器直接进入该 App 的首屏，共用目标清单里的入口、WebGL 模式和素材声明。可以用浏览器开发者工具调节视口，查看控制台、网络请求和 TypeScript 源码。
2. 在浏览器检查首屏、3D 场景、HUD、窗口尺寸变化和点击、拖动等交互。比如用 `nohara-house` 检查切房和拖动相机，用 `ocean-shelter` 在网络面板检查 GLB、外部贴图、HDR 和 HUD 图集。浏览器以当前视口模拟安全区，双指手势可在支持触摸的浏览器环境中联调。
3. 保存已纳入构建的源码或已有素材后，esbuild 重建并刷新页面，App 从首屏重新开始。新增、删除或重命名素材，或者修改 `scripts/targets.json` 后，重启命令以重新读取目标配置和素材列表。可在不同终端同时启动多个目标，各终端打印各自的端口。按 `Ctrl+C` 停止当前预览。

网页开发服务器只监听本机，构建结果保存在各进程内存中。逻辑输出目录为 `.build/web/<目标名>/`，网页中的 `/dist/resources/` 对应所选目标的素材 URL。工程的 `dist/`、`game.json` 和微信项目配置归微信流程管理。网页联调期间，微信开发者工具可以继续使用当前的微信构建。

网页和微信共用 App 入口、Three.js 场景、Pixi HUD 和业务逻辑。新增平台能力时，在框架中维护相应的平台适配，并按各端实际支持的行为验收。

本地资源通过 HTTP 读取，分包资源在浏览器中直接从所选目标的运行资源目录读取。`model-viewer`、`showcase-model` 和 `webgl2-model` 优先使用同级 `WechatAssetServer/model.glb`。文件缺失时，使用原模型 URL，该服务需允许浏览器跨源读取。微信原生手势、分包挂载、`--runtime-url` 下载链路、平台生命周期和真机表现按下一节验收。

## 5. 微信构建与开发者验收

同一工作区的各个目标会更新同一份 `dist/game.bundle.js`、`dist/resources/` 和 `game.json` 中受构建管理的分包声明。多 Agent 共用工作区时，由一个 Agent 负责 `build:target` 并向开发者交接产物，其余 Agent 可以并行运行类型检查、自动测试和代码审查。需要同时联调不同目标时，分别在独立 Git 工作树构建，由开发者在微信开发者工具中导入各自的工程根目录。

代码或素材改动后，运行以下检查。把示例中的 `ocean-shelter` 换成本次目标。

~~~powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build:target -- ocean-shelter
~~~

1. **核对产物。** 查看构建日志中的入口、渲染器和打包素材。涉及资源分包或远程模式时，对照 `dist/resources/` 和 `game.json`。验证其他目标或资源模式后，按本次交付的目标和资源模式重新构建。
2. **交接微信端验收。** AI 提供构建目标、首屏和关键触摸路径，开发者在微信开发者工具编译并验证。涉及场景切换时检查退出和重进。涉及资源时检查实际读取路径与加载失败处理。新增或修改远程模式时，分别构建默认分包与 `--runtime-url` 模式，确认远程产物已移除运行资源分包。开发者检查两种模式的主包 HUD，并各验证至少一个运行资源的实际加载。
3. **记录平台差异。** AI 记录本地构建与浏览器验证结果，模拟器、微信预览和真机按开发者提供的结果更新，否则标为待验。远程真机验收按 [资源联调说明](ARCHITECTURE_AND_USAGE.md#33-真机预览与日志定位) 验证已登记的 HTTPS 下载域名与冷启动。
4. **定位预览文件错误。** 出现旧路径的 `ENOENT` 时，先比对当前目标清单、产物和微信工具打包配置，并检查项目文件列表缓存。以实际预览结果确认打包修复。 [旧素材故障记录](development/wechat-preview-enoent.md)

本地编译用于开发验收。生成微信预览码会向微信发送当前游戏包。执行预览、上传、发布或部署远程素材前应获得用户明确授权。

## 6. 归档与交付

交付前把业务变更、框架接口、资源、构建、开发流程改动和故障修复记入 [开发归档](development/README.md#如何补充记录)。对应主题已有记录时补充证据和结果，新增主题时同步更新索引。

交付时记录以下内容，便于下一个开发者或 AI 接手。

- 交付的 App、入口、构建命令和首屏。
- 主要业务改动，以及涉及的共享接口和受影响目标。
- 主包素材和运行时素材的来源，远程模式还应记录资源版本或 URL 类型。
- 已运行的网页联调、自动验证和微信验收及各自结果，以及待验证项和当前留在工作区的微信构建目标及资源模式。
