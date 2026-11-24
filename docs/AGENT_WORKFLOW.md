# AI 业务开发工作流

本文件是 AI 在 PixiWechatTest 中开发业务的入口。适用于新建独立 App、修改既有 App，以及为具体业务补足共享框架能力。命令在 PixiWechatTest 工程根目录运行。

## 1. 确定开发目标

1. 读清需求，确认是新 App、已有 App 修改，还是共享框架问题。确定交付构建目标、可见交互和需要验证的异常路径。
2. 在 [开发归档](development/README.md) 按 App ID、框架模块或错误关键词查记录。核对已试过的方案、相关代码和待验项，再比对当前实现。
3. 查 [目标清单](../scripts/targets.json)，用 `npm.cmd run build:list` 核对入口。涉及公共运行时或发布时，再查 [框架架构](FRAMEWORK_ARCHITECTURE.md)、[架构与使用指南](ARCHITECTURE_AND_USAGE.md) 和 [QA 记录](QA.md) 的相关章节。
4. 选与需求最接近的现有示例。单场景参考 [颜色匹配入口](../src/game/apps/color-match/main.ts)，独立场景加分包资源参考 [海上避难所入口](../src/game/apps/ocean-shelter/main.ts)，应用内多场景切换参考 [Showcase](../src/game/apps/showcase/startGameApp.ts)。

## 2. 按归属装配代码

| 目录 | 归属 |
| --- | --- |
| `src/game/apps/<app-id>/` | App 专属的 TypeScript 入口、场景、镜头、HUD、业务状态和资源路径。 |
| `src/game/common/` | 多个 App 实际复用的业务模块、组件和资源描述。 |
| `src/framework/` | 微信平台适配、共享运行时、渲染、输入和资源读取等通用能力。 |

**新业务走独立目标。** 在 `src/game/apps/<app-id>/main.ts` 调用 `startGame`，并在 `scripts/targets.json` 增加同名目标。运行该目标的产物应直接进入 App 首屏。任务需要集成首页入口时，由 `showcase` 自己装配导航。

**依赖方向为 `apps → common → framework`。** App 可以直接引用框架。禁止跨 App 导入，也禁止公共业务或框架反向引用 App。优先使用现有框架接口，需要补足当前业务所需的共享能力时，再扩展框架。共享改动保留既有调用方式，并为新增行为补回归。

- 场景工厂提供 `camera` 和 `update(delta)`。相机交互可以使用 `controls` 或自定义 `touch(event)`。按需提供 `resize`、`afterRender`、`dispose` 和场景渲染设置。 [运行时接口](../src/framework/runtime/startGame.ts)
- 通过 `startGame` 的 HUD 加载回调延迟引入 Pixi 模块和扩展，保留微信兼容处理的初始化顺序。框架管理一张上屏 Canvas 和一条帧循环，同一帧先绘制 Three.js，再绘制 Pixi HUD。 [HUD 装配](../src/framework/ui/loadHud.ts)
- 触摸开始时由 HUD 或场景接管整段手势。按钮在有效释放时执行，拖动和取消由当前接管者处理。切换场景时，旧场景负责释放自己创建的资源，包括退出后才就绪的异步结果。 [微信触摸分流](../src/framework/platform/WechatPlatform.ts)
- 渲染版本由目标的 `renderer` 配置选择，省略时使用 WebGL1。需要 WebGL2 的能力应在对应目标和设备上验证。 [渲染配置](ARCHITECTURE_AND_USAGE.md#11-入口与渲染配置)

## 3. 声明主包和运行资源

App 专属素材使用与代码同名的 `media/<app-id>/`。共用文件由实际用到它的目标分别声明。构建保留素材目录内相对路径，GLB 与它引用的外部贴图一起组织。

| 目标字段 | 典型内容 | 构建和读取方式 |
| --- | --- | --- |
| `assets` | 单文件素材，如共用 HUD 图集 | 路径相对于 `media/`，原相对路径复制到 `dist/resources/`。 |
| `packagedResources` | `media/<app-id>/packaged/` 内的启动图标、字形和 HUD | 复制到 `dist/resources/packaged/<目标名>/`，由主包直接提供。 |
| `runtimeResources` | `media/<app-id>/runtime/` 内的场景模型、贴图和环境资源 | 默认复制到 `dist/resources/<目标名>/` 并登记为微信分包。传 `--runtime-url` 时，构建选择运行时下载，游戏包省去该分包。 |

新 App 通过 [共享资源加载器](../src/framework/assets/createResourceLoader.ts) 的 `loadImage(relativePath)` 和 `readBinary(relativePath)` 读取资源。框架负责分包挂载和远程下载，App 负责把资源交给 Three.js 或 PixiJS、显示加载状态，以及选择失败提示、重试或降级。远程资源服务保持运行目录结构，可以通过版本目录区分内容。 [运行时资源配置](ARCHITECTURE_AND_USAGE.md#运行时资源)

`dist/` 由构建生成，`game.json` 中由目标管理的分包也由构建同步。修改资源归属时，同时核对源路径、目标声明和 App 中的读取路径。

## 4. 构建并验证

代码或素材改动后，运行以下检查。把示例中的 `ocean-shelter` 换成本次目标。

~~~powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build:target -- ocean-shelter
~~~

1. **核对产物。** 查看构建日志中的入口、渲染器和打包素材。涉及资源分包或远程模式时，对照 `dist/resources/` 和 `game.json`。验证其他目标后，重新构建本次交付目标。
2. **验证首屏和关键操作。** 在微信开发者工具编译当前产物，核对目标首屏、HUD 和关键触摸路径。涉及场景切换时检查退出和重进。涉及资源时检查实际读取路径与加载失败处理。
3. **记录平台差异。** 分别记录本地构建、模拟器、微信预览和真机的结果。远程真机验收按 [资源联调说明](ARCHITECTURE_AND_USAGE.md#33-真机预览与日志定位) 验证已登记的 HTTPS 下载域名与冷启动。
4. **定位预览文件错误。** 出现旧路径的 `ENOENT` 时，先比对当前目标清单、产物和微信工具打包配置，并检查项目文件列表缓存。以实际预览结果确认打包修复。 [旧素材故障记录](development/wechat-preview-enoent.md)

本地编译用于开发验收。生成微信预览码会向微信发送当前游戏包。执行预览、上传、发布或部署远程素材前应获得用户明确授权。

## 5. 归档与交付

交付前把业务变更、框架接口、资源或构建改动和故障修复记入 [开发归档](development/README.md#如何补充记录)。对应主题已有记录时补充证据和结果，新增主题时同步更新索引。

交付时记录以下内容，便于下一个开发者或 AI 接手。

- 交付的 App、入口、构建命令和首屏。
- 主要业务改动，以及涉及的共享接口和受影响目标。
- 主包素材和运行时素材的来源，远程模式还应记录资源版本或 URL 类型。
- 已运行的验证和实际结果，以及待验证项和当前留在工作区的构建目标。
