# 开发归档

按 App、框架模块或报错关键词找对应记录。记录包含当时的改动、定位依据和验证范围。开发约束与执行步骤见 [AI 业务开发工作流](../AGENT_WORKFLOW.md)。

| 查找内容 | 记录 |
| --- | --- |
| `ocean-shelter`、独立入口、船体剖面、舱室、HUD | [海上避难所](ocean-shelter.md) |
| `startGame`、`touchcancel`、OrbitControls、阴影和渲染钩子 | [共享场景运行时](framework.md#共享场景运行时) |
| `packagedResources`、`runtimeResources`、`--runtime-url`、GLB 外部贴图 | [主包与运行时资源](framework.md#主包与运行时资源) |
| 预览 `ENOENT`、`dist/media/pixi-ui-probe.png`、旧图集 | [微信预览读取旧素材](wechat-preview-enoent.md) |
| 既有模型查看器、Draco、Pixi 初始化、触摸故障和验收基线 | [QA 记录](../QA.md) · [模型与首版交接](../PROJECT_STATUS_AND_AGENT_HANDOFF.md) |

也可直接搜索 App ID、文件名或原始错误片段。

~~~powershell
rg -n 'ocean-shelter|ENOENT|runtimeResources' docs/development docs/QA.md
~~~

## 如何补充记录

交付业务功能、共享接口、资源或构建变更，以及可复用的故障修复时，更新对应主题。复发或复验时，在已有记录补上新证据和结果。新增主题时，在上表添加入口和可搜索的关键词。

| 字段 | 要记录的内容 |
| --- | --- |
| 范围 | 日期、App 或目标、受影响模块。已有提交时可附提交号。 |
| 背景 | 需求或报错、触发条件、已证实的原因。推断注明推断。 |
| 改动 | 采用的方案、源码或配置入口、后续修改时要保留的约定。 |
| 验证 | 实际执行的命令、构建模式、模拟器或真机环境及结果。按记录发生时的版本注明待验项。 |

日志保留有助于复现的报错和环境信息，省略账号标识、凭据和预览码。
