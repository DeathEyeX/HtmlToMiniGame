# 共享框架开发记录

## 共享场景运行时

**范围**　2026-11-23，为 `ocean-shelter` 接入自定义相机和舱室阴影，源码基线可查 `d845c47`。

**改动**　`SceneSetup` 提供可选的 `controls`、`touch(event)`、`resize` 和 `afterRender`，并支持场景级物理光照与阴影配置。HUD 命中后持有整段手势。未被 HUD 接管的触摸可交给场景自定义处理，含原生 `touchcancel`。框架继续提供 OrbitControls 的平台桥。场景换入时先应用默认渲染设置，再应用场景配置。Three.js 完成绘制后调用 `afterRender`，随后绘制 Pixi HUD。 [场景运行时](../../src/framework/runtime/startGame.ts) · [触摸桥](../../src/framework/platform/WechatPlatform.ts)

**验证**　输入回归验证 HUD 的手势所有权、场景收到取消和 OrbitControls 回退。运行时回归验证场景切换及前后台共用一条帧循环。更改任何一个钩子时，参考 [输入测试](../../tests/platform-input.test.cjs) 和 [运行时测试](../../tests/runtime-startup.test.cjs)。

## 主包与运行时资源

**范围**　2026-11-24，`packagedResources`、`runtimeResources`、`--runtime-url` 与 `createResourceLoader`，源码基线可查 `d845c47`。

**改动**　构建按目标递归收集目录，保留素材相对路径。主包资源输出到 `dist/resources/packaged/<目标名>/`。默认运行资源输出到 `dist/resources/<目标名>/`，同时更新 `game.json` 的分包声明。远程构建省略分包，App 读取注入的 `GAME_RUNTIME_ASSET_URL` 选择远程来源。框架合并重复挂载与下载请求，并复用本次会话内有效的临时路径。App 负责解码后的 Three.js／Pixi 对象和失败后的界面。 [构建实现](../../scripts/build.cjs) · [共享加载器](../../src/framework/assets/createResourceLoader.ts) · [配置说明](../ARCHITECTURE_AND_USAGE.md#运行时资源)

**验证**　当时全仓类型检查和 26 项测试通过。默认分包及本机 HTTP 下载路径经微信模拟器验证，公网 HTTPS 真机链路待验。改资源加载时，复测同一资源的并发请求、分包挂载失败后重试、非 200 和临时文件失效。改打包时，复测目标隔离、远程模式的主包文件和切回默认目标后的分包声明。 [加载器测试](../../tests/resource-loader.test.cjs) · [构建测试](../../tests/build-targets.test.cjs)

## 单 App 网页联调

**范围**　2026-11-24，`npm.cmd run dev:web -- <目标名>`。适用于单 App 首屏、Three.js 场景、Pixi HUD、指针输入和本地素材联调。 [开发工作流](../AGENT_WORKFLOW.md#4-本地网页联调)

**改动**　网页构建复用微信目标的入口、渲染器和素材清单。esbuild 在本机端口提供内存产物和刷新事件。浏览器入口先安装 Canvas、指针和资源的兼容层，再启动目标 App。旧模型示例复用 GLTF 与 Draco 解析，通过浏览器 HTTP 读取模型。微信构建继续由 `build:target` 发布到项目的 `dist/` 并同步 `game.json`。 [网页命令](../../scripts/dev-web.cjs) · [浏览器兼容层](../../src/framework/platform/browser/installBrowserWx.ts)

**验证**　11 个目标均能生成网页产物。全仓类型检查和 29 项自动测试通过。无头 Edge 验证 `nohara-house` 切房、拖动和调整视口，`ocean-shelter` 的 GLB、外部贴图、HDR 和 HUD，以及 `model-viewer` 的 WebGL2 和 Draco 模型。在临时工程验证了已有素材修改会触发网页刷新事件，并完成 `nohara-house` 和 `ocean-shelter` 的微信构建，其中 `ocean-shelter` 构建时网页服务同时运行。本工程原有 `dist/`、`game.json` 的文件清单与 SHA-256 一致，当前微信产物为 `nohara-house`。微信模拟器及真机未在本次复测。 [网页构建回归](../../tests/web-preview.test.cjs)

## Agent 工作流审核

**范围**　2026-11-24，审核新 App 接入、共享工作区联调与开发归档。

**依据**　从项目父目录启动时，子目录的项目指令不在 Codex 的启动查找路径内。内存构建验证了入口即使未读取 `GAME_RUNTIME_ASSET_URL`，也可以成功构建并省略本地分包。同一工作区的每次目标构建会更新同一份微信工具产物。

**改动**　在父工作区添加只指向本工程的指引，并在项目 README 给出推荐的启动目录。工作流增加 App 资源模式切换、双模式验收和并行联调的构建分工。九个目标及 22 项测试保留为历史快照，当前清单从构建命令查询。 [项目入口](../../README.md) · [开发工作流](../AGENT_WORKFLOW.md) · [构建快照](../ARCHITECTURE_AND_USAGE.md#13-2026-11-23-构建快照)

**验证**　父目录和项目内两份指引都链接到同一工作流。106 个本地链接及锚点通过检查。`npm.cmd run build:list` 列出 10 个目标，`npm.cmd run typecheck` 和 `npm.cmd test` 通过，共 26 项自动测试。本次为文档更新，微信端验证沿用对应功能记录。

### App 目录与注释

**范围**　2026-11-24，`ocean-shelter`、`nohara-house`、`showcase` 和 `pixi-ui`。

**改动**　前两个 App 用 `hud/` 和 `three/` 组织专属实现。Showcase 与 Pixi 诊断只需归类本地 HUD，场景由公共模块提供。各构建入口仍在 App 根目录。同步更新测试引用和两套字形脚本的输出路径。工作流补充注释要求，代码中就初始化顺序、资源释放和镜头留白补了说明。 [开发工作流](../AGENT_WORKFLOW.md#代码注释)

**验证**　全仓类型检查和 27 项测试通过。在隔离目录成功构建 `pixi-ui`、`showcase`、`showcase-model`、`ocean-shelter` 和 `nohara-house`，另核对海上避难所远程模式仅保留主包 HUD 素材。两套脚本再生的字形索引和图集像素一致。工作区现有 `nohara-house` bundle 与新构建逐字节一致。本次未运行微信模拟器、预览和真机。

**工作流补充**　明确 Web 与微信共用 App 逻辑，平台差异由框架适配。将 Three.js 场景常见的注释检查项写入工作流，覆盖坐标与镜头、关键参数、绘制顺序和资源生命周期。 [代码注释](../AGENT_WORKFLOW.md#代码注释) · [网页联调](../AGENT_WORKFLOW.md#4-本地网页联调)

### 默认业务框架与验收分工

**范围**　2026-11-24，工作区和项目的 `AGENTS.md`，以及微信构建交接流程。

**改动**　将新业务的固定框架要求写入工作区指引。「新 App」默认走 `PixiWechatTest` 的独立目标，由 `startGame` 装配 Three.js 场景与 Pixi HUD，通过同一入口联调和构建。开发者负责微信开发者工具内的验收。 [项目约定](../../AGENTS.md#项目约束) · [构建交接](../AGENT_WORKFLOW.md#5-微信构建与开发者验收)

## 本地迁移与验收工具

**范围**　2026-11-25，HTML 原型接入、无头浏览器首帧检查、Pixi HUD 命中区和微信构建报告。

**改动**　`migrate:html` 解析单模块入口和本地依赖，输出带位置的迁移诊断。`--apply` 创建独立 App 和资源目录，入口通过类型检查和内存打包后登记目标。`test:browser` 复用网页预览，在 Three 和 Pixi 提交首帧后采集截图和报告。`nohara-house` 复用房间按钮的命中数据导出布局，检查钩子仅进入无头检查构建。`build:report` 复用构建产物清单，汇总主包、分包和远程资源，检查 GLB／glTF 依赖与可静态识别的资源读取路径。 [工具用法](../LOCAL_TOOLS.md)

**验证**　`npm.cmd run typecheck` 和 42 项自动回归通过。迁移测试从原型生成独立目标并构建，覆盖类型和打包失败后回收生成目录。无头 Edge 验证 `nohara-house` 的小屏、手机、桌面和六个按钮的命中区，`ocean-shelter` 手机首帧与资源加载，以及 `webgl2` 桌面首帧。独立目录中完成 `nohara-house` 和 `ocean-shelter` 的默认微信构建，也用示例 URL 构建了 `ocean-shelter` 远程模式。两种模式都包含主包 HUD，远程构建省略了运行资源分包。

**交接**　工作区根目录产物为 `mad-water-haven`。本次验收产物位于 `.build/tooling-acceptance-38808a3b25/`。微信开发者工具可分别导入该目录下的两个默认构建。`nohara-house` 检查院落首屏、房间按钮松手切换、取消和拖动。`ocean-shelter` 检查全船首屏、舱室聚焦、GLB 外部贴图和 HUD。模拟器、微信预览、真机及部署后的远程下载待开发者验证。

## 持续检查与独立发布

**范围**　2026-11-25，GitHub Actions 和静态 Web／微信小游戏发布目录。

**改动**　CI 调用现有的类型检查、回归、构建报告、无头浏览器及发布命令，保留报告、截图和 `ocean-shelter` 的静态产物。网页发布复用既有入口和相对素材路径，支持静态站点子目录。微信隔离构建复用目标清单、分包设置和原有逐文件发布及回滚，在 `.build/releases/<app-id>/` 下区分 `web`、`wechat` 和 `wechat-remote`。无头检查关闭开发用刷新连接，并增加了大型场景在软件 WebGL 中等待首帧的时间。 [工具用法](../LOCAL_TOOLS.md#独立发布产物)

**验证**　全仓类型检查和 44 项自动回归通过，覆盖独立产物共存、旧文件清理与发布失败回滚。无头 Edge 在 HTTP 子目录中运行了 `ocean-shelter` 和 `model-viewer` 的静态产物，核对了相对脚本路径、主包 HUD、GLB、外部贴图和 HDR 请求。复测通过原有 `nohara-house` 三视口 HUD、`ocean-shelter` 手机首帧与 `webgl2` 桌面首帧。`ocean-shelter/wechat` 实际文件与审计一致，主包原始文件计 1,407,192 字节，普通分包 9,257,337 字节。`wechat-remote` 保留主包 HUD，运行资源分包省略，本地源资源计 9,257,313 字节。远程构建使用 `example.invalid` 作清单验证。

**交接**　工作区根目录产物仍为 `mad-water-haven`。微信开发者工具导入 `.build/releases/ocean-shelter/wechat/` 后，可验证全船首屏、舱室点按、拖动、贴图和 HUD，并记录实际包分析及冷启动。GitHub 托管运行、微信模拟器、预览和真机验收待完成。
