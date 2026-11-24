# 微信小游戏框架架构与易用性审核

核对日期为 2026-11-23。工程用 TypeScript 编写应用，以 Three 渲染 3D、PixiJS 绘制 UI，再生成微信小游戏可加载的产物。[构建与使用](ARCHITECTURE_AND_USAGE.md) · [故障与检验记录](QA.md) · [迁移与交接](PROJECT_STATUS_AND_AGENT_HANDOFF.md)

## 1. 可用性结论

当前可作为同仓库开发微信小游戏的应用模板。新应用从自身 TypeScript 入口启动，复用平台、渲染、手势和资源能力。当前已本地验证九种构建、独立配装台、颜色匹配、集成首页、Pixi 位图图集以及真实 GLB 回归。微信工具与目标手机的当前产物验收、实际包大小和关闭调试的公网资源链路待开发者记录。

## 2. 模块划分

### 2.1 入口与所有权

| 目录 | 负责内容 |
| --- | --- |
| `src/framework/` | `startGame` 统一驱动 Canvas、Three、Pixi、手势和场景生命周期。可选 GLB／Draco 模块负责下载、缓存、校验和解码。 |
| `src/game/common/` | 多个应用实际共用的立方体、操作 HUD、位图图集、配装台、颜色匹配和模型场景。各模块按功能提供工厂或函数。 |
| `src/game/apps/` | 每个应用拥有独立 TypeScript 入口，定义首屏、页面装配和失败提示。集成首页的导航、工具栏及模型进度由 `showcase` 所有。 |
| `scripts/` | 维护构建目标，读取入口和包内素材，生成 `dist`。 |

### 2.2 当前目录

```text
game.js                          微信运行入口
scripts/
  targets.json                   目标、入口和素材清单
  build.cjs                      目标类型检查、ES2019 构建和产物写入
src/
  framework/
    runtime/  rendering/  platform/  ui/  assets/
  game/
    apps/
      controls/  model-viewer/  pixi-ui/  webgl2/
      showcase/  workbench/  color-match/
    common/
      controls/  three/  ui/  model-viewer/  workbench/  color-match/
media/                           仓库中的素材源文件
dist/                            生成的 bundle 和选定素材
```

依赖沿 `apps → common → framework`，应用也可直接依赖框架。应用间不跨目录导入，`common` 不引用任何应用，框架不引用业务。代码检查覆盖运行时加载和类型导入。以配装台为例，独立入口和 `showcase` 共用 `common/workbench/` 的 3D 及 HUD，后者传入返回动作。颜色匹配同理。模型场景和资源描述归公共模块，只有 `showcase/withModel.ts` 装配 `showcase` 专用模型进度 HUD。

### 2.3 构建入口

`scripts/targets.json` 对每个目标指定一个入口。本地执行 `npm.cmd run build:list` 查入口，使用 `npm.cmd run build:target -- <目标名>` 构建。每目标类型检查只验证其入口的依赖和项目声明，`npm.cmd run typecheck` 执行全仓检查。产物固定由 `game.js` 加载，微信工具切换目标时重新编译。[目标与命令](ARCHITECTURE_AND_USAGE.md#1-当前基线)

只有目标入口可达的代码进入 bundle。模型查看和 WebGL2 分别在需要的构建中装配。延迟 `import()` 用于推迟初始化，在单文件 IIFE 中仍属于同一产物。可按需从具体功能导入公共模块，避免全量注册产生额外依赖。[esbuild Tree Shaking](https://esbuild.github.io/api/#tree-shaking)

## 3. 场景切换与失败恢复

1. 每个应用通过 `startGame` 创建上屏 Canvas，使用同一 WebGL 上下文依次渲染 Three 与 Pixi。目标清单的 `renderer` 默认 `webgl1`，显式设置 `webgl2` 时由框架验证创建。模型材质和 Pixi 根据实际上下文选择对应版本。
2. HUD 工厂在 `navigator` 与 `performance` 兼容处理之后、Pixi 渲染器初始化之前加载。保留 `globalThis.Intl`、`globalThis.performance` 构建映射。需要注册 BitmapText 等 Pixi 扩展时，通过 HUD 加载回调引入。
3. 手势在按下时由 HUD 决定是否接管。命中的控件处理拖动、释放和取消，3D 区域的手势交给场景的自定义触摸回调或 OrbitControls。`switchScene` 负责换场景并调用旧场景的释放函数，业务拥有自己的 HUD 及退出动作。
4. 模型通过场景描述获取 URL、缓存键和版本。保留纯 JS Draco、内嵌图片、取消、失败重试、热缓存和旧场景资源清理。模型退出后，迟到回调只负责清理。

## 4. 构建和资源发布

素材源文件放在 `media/`。目标通过 `assets` 声明单文件，通过 `packagedResources` 声明随主包发布的素材目录，通过 `runtimeResources` 声明运行时资源目录。构建验证素材和类型，更新 `dist/` 和由目标管理的分包声明，并移除上一目标的多余素材。更新失败时恢复受影响的文件。验收包体时，以开发者工具的实际包分析为准。

运行时资源默认由微信分包提供，也可以通过目标构建参数切换到远程资源服务。既有模型查看器通过专用 GLB 加载器下载并管理版本缓存。 [运行时资源](ARCHITECTURE_AND_USAGE.md#运行时资源) · [模型普通预览](PROJECT_STATUS_AND_AGENT_HANDOFF.md#74-关闭调试的普通扫码验收)

## 5. 分阶段实施与验收

| 状态 | 检查 |
| --- | --- |
| 本地通过 | 九个框架回归目标的构建、ES2019 语法、目标素材清单、渲染器隔离、严格类型检查与 22 项自动测试。 |
| 本地通过 | 软件 WebGL 下，集成首页和独立目标的配装台、颜色匹配、Pixi Sprite 和位图数字；有模型首页使用真实 GLB 验证加载、取消、失败重试和缓存退出。 |
| 微信端待复测 | 在微信工具和目标手机核对新目录构建后的交互、图集新路径、两个独立入口及模型联合构建。记录实际包文件与字节数。 |
| 发布待验收 | 配置正式 AppID 和 HTTPS 下载域名，关闭开发者调试后验证模型冷下载和热缓存。按设备记录首屏及首次入场时间。 |

## 6. 独立业务与公共模块设计

### 6.1 新应用接入验证

在隔离工程中，只保留框架、共用立方体和测试新应用的两份 TypeScript 文件，再登记一条目标映射。分别保留带语法错误的无关应用、再移除该应用，两次均出包。产物未包含未引用的公共模块和图片。桌面软件 WebGL 读取像素，确认新应用的 Three 立方体和自定义 Pixi HUD 在同一 Canvas 显示。当前流程可以作为正式业务接入的起点。[新增应用步骤](ARCHITECTURE_AND_USAGE.md#5-新增应用和素材)

### 6.2 易用性边界

- **入口可定位。** 目录名和构建目标一一对应，组合版本在同一应用目录，命令输出显示实际入口与素材。
- **复用可验证。** 多目标引用才提到 `common`。例如首页的工具栏只随 `showcase`，轻量目标的依赖图排除了模型 HUD、GLB／Draco 和 WebGL2 探针。
- **渲染 API 的使用门槛。** 新场景实现相机、控制器、逐帧更新和释放，HUD 处理命中与手势。已有两个可直接照用的独立应用，较复杂 UI 仍需常规 Pixi 调试与微信端验证。
- **资源需要声明。** 目标通过 `assets`、`packagedResources` 和 `runtimeResources` 明确其素材范围。 [AI 业务开发工作流](AGENT_WORKFLOW.md#3-声明主包和运行资源)
- **发布准备。** 在正式项目中换 AppID、接入合法 HTTPS 域名并完成实测后，才能形成该项目的发布验收记录。

### 6.3 开发目标选择建议

下一步可增加交互式开发菜单。从 `scripts/targets.json` 读取目标，按业务和诊断分组显示可读名称，选择后调用同一个构建器，并显示实际入口及产物。自动化和正式发布通过 `build:target` 传入确认的目标名。应用内的多场景切换由该应用自己的导航提供。

菜单可以同时展示目标的 `renderer`。当前命令 `build:list` 已显示目标、渲染器和入口。WebGL2 构建映射与框架的启动分支读取同一个 `renderer` 值。[入口与渲染配置](ARCHITECTURE_AND_USAGE.md#11-入口与渲染配置)
