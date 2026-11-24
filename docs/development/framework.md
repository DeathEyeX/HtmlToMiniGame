# 共享框架开发记录

## 共享场景运行时

**范围**　2026-11-23，为 `ocean-shelter` 接入自定义相机和舱室阴影，源码基线可查 `d845c47`。

**改动**　`SceneSetup` 提供可选的 `controls`、`touch(event)`、`resize` 和 `afterRender`，并支持场景级物理光照与阴影配置。HUD 命中后持有整段手势。未被 HUD 接管的触摸可交给场景自定义处理，含原生 `touchcancel`。框架继续提供 OrbitControls 的平台桥。场景换入时先应用默认渲染设置，再应用场景配置。Three.js 完成绘制后调用 `afterRender`，随后绘制 Pixi HUD。 [场景运行时](../../src/framework/runtime/startGame.ts) · [触摸桥](../../src/framework/platform/WechatPlatform.ts)

**验证**　输入回归验证 HUD 的手势所有权、场景收到取消和 OrbitControls 回退。运行时回归验证场景切换及前后台共用一条帧循环。更改任何一个钩子时，参考 [输入测试](../../tests/platform-input.test.cjs) 和 [运行时测试](../../tests/runtime-startup.test.cjs)。

## 主包与运行时资源

**范围**　2026-11-24，`packagedResources`、`runtimeResources`、`--runtime-url` 与 `createResourceLoader`，源码基线可查 `d845c47`。

**改动**　构建按目标递归收集目录，保留素材相对路径。主包资源输出到 `dist/resources/packaged/<目标名>/`。默认运行资源输出到 `dist/resources/<目标名>/`，同时更新 `game.json` 的分包声明。远程构建省略分包，App 读取注入的 `GAME_RUNTIME_ASSET_URL` 选择远程来源。框架合并重复挂载与下载请求，并复用本次会话内有效的临时路径。App 负责解码后的 Three.js／Pixi 对象和失败后的界面。 [构建实现](../../scripts/build.cjs) · [共享加载器](../../src/framework/assets/createResourceLoader.ts) · [配置说明](../ARCHITECTURE_AND_USAGE.md#运行时资源)

**验证**　当时全仓类型检查和 26 项测试通过。默认分包及本机 HTTP 下载路径经微信模拟器验证，公网 HTTPS 真机链路待验。改资源加载时，复测同一资源的并发请求、分包挂载失败后重试、非 200 和临时文件失效。改打包时，复测目标隔离、远程模式的主包文件和切回默认目标后的分包声明。 [加载器测试](../../tests/resource-loader.test.cjs) · [构建测试](../../tests/build-targets.test.cjs)

## Agent 工作流审核

**范围**　2026-11-24，审核新 App 接入、共享工作区联调与开发归档。

**依据**　从项目父目录启动时，子目录的项目指令不在 Codex 的启动查找路径内。内存构建验证了入口即使未读取 `GAME_RUNTIME_ASSET_URL`，也可以成功构建并省略本地分包。同一工作区的每次目标构建会更新同一份微信工具产物。

**改动**　在父工作区添加只指向本工程的指引，并在项目 README 给出推荐的启动目录。工作流增加 App 资源模式切换、双模式验收和并行联调的构建分工。九个目标及 22 项测试保留为历史快照，当前清单从构建命令查询。 [项目入口](../../README.md) · [开发工作流](../AGENT_WORKFLOW.md) · [构建快照](../ARCHITECTURE_AND_USAGE.md#13-2026-11-23-构建快照)

**验证**　父目录和项目内两份指引都链接到同一工作流。106 个本地链接及锚点通过检查。`npm.cmd run build:list` 列出 10 个目标，`npm.cmd run typecheck` 和 `npm.cmd test` 通过，共 26 项自动测试。本次为文档更新，微信端验证沿用对应功能记录。
