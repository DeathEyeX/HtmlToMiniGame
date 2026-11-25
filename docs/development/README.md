# 开发归档

按 App、框架模块或报错关键词找对应记录。记录包含当时的改动、定位依据和验证范围。开发约束与执行步骤见 [AI 业务开发工作流](../AGENT_WORKFLOW.md)。

| 查找内容 | 记录 |
| --- | --- |
| `ocean-shelter`、独立入口、船体剖面、舱室、HUD | [海上避难所](ocean-shelter.md) |
| `drift-era`、像素风海上庇护所、多层通行、联络任务 | [漂流纪元](drift-era.md) |
| `tidal-harbor`、滑动环绕、卡通像素材质、水线遗迹、海底城区 | [潮汐浮城](tidal-harbor.md) |
| `saltwind-haven`、模块化浮台、动态海面、七个功能区、净屏取景 | [盐风庇护所](saltwind-haven.md) |
| `mad-water-haven`、疯狂水世界、三层住宅、水下避难所、潜水镜头、区域聚焦 | [疯狂水世界风海上庇护所](mad-water-haven.md) |
| `nohara-house`、野原家、卡通房屋、房间切换、拖动旋转、小新模型、中文图集 | [野原家的小屋](nohara-house.md) |
| `cyber-beast`、霓虹异骸、裂隙猎犬、低模、原地踏步、旋转展台 | [赛博生物展厅](cyber-beast.md) |
| `startGame`、`touchcancel`、OrbitControls、阴影和渲染钩子 | [共享场景运行时](framework.md#共享场景运行时) |
| `packagedResources`、`runtimeResources`、`--runtime-url`、GLB 外部贴图 | [主包与运行时资源](framework.md#主包与运行时资源) |
| `dev:web`、浏览器联调、网页和微信构建隔离 | [单 App 网页联调](framework.md#单-app-网页联调) |
| `migrate:html`、`test:browser`、HUD 命中区、`build:report` | [本地迁移与验收工具](framework.md#本地迁移与验收工具) |
| `build:web`、`--isolated`、静态站点子目录 | [独立发布产物](framework.md#独立发布产物) |
| `AGENTS.md`、代码注释、App 目录、多 Agent、构建产物覆盖、历史基线 | [Agent 工作流审核](framework.md#agent-工作流审核) |
| 预览 `ENOENT`、`dist/media/pixi-ui-probe.png`、旧图集 | [微信预览读取旧素材](wechat-preview-enoent.md) |
| 既有模型查看器、Draco、Pixi 初始化、触摸故障和验收基线 | [QA 记录](../QA.md) · [模型与首版交接](../PROJECT_STATUS_AND_AGENT_HANDOFF.md) |

也可直接搜索 App ID、文件名或原始错误片段。

~~~powershell
rg -n 'ocean-shelter|ENOENT|runtimeResources' docs/development docs/QA.md
~~~

## 如何补充记录

交付业务功能，修改共享接口、资源、构建或开发流程，以及完成可复用的故障修复时，更新对应主题。复发或复验时，在已有记录补上新证据和结果。新增主题时，在上表添加入口和可搜索的关键词。

| 字段 | 要记录的内容 |
| --- | --- |
| 范围 | 日期、App 或目标、受影响模块。已有提交时可附提交号。 |
| 背景 | 需求或报错、触发条件、已证实的原因。推断注明推断。 |
| 改动 | 采用的方案、源码或配置入口、后续修改时要保留的约定。 |
| 验证 | 实际执行的命令、构建模式、模拟器或真机环境及结果。按记录发生时的版本注明待验项。 |

日志保留有助于复现的报错和环境信息，省略账号标识、凭据和预览码。
