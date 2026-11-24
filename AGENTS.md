# PixiWechatTest AI 开发约定

## 第一步是阅读工作流

进入本项目后，先完整阅读 [AI 业务开发工作流](docs/AGENT_WORKFLOW.md)，再修改代码、添加素材或运行构建。工作流给出独立 App 的接入步骤、框架改动边界和验收要求。

改动前按 App、模块或报错查询 [开发归档](docs/development/README.md)。交付功能、框架或构建变更和故障修复时，更新对应记录。

## 项目约束

- 「新 App」「新 app」「新业务模块」都表示创建独立构建目标。用户只需描述业务需求。未指定 App ID 时按业务命名，在 `src/game/apps/<app-id>/main.ts` 提供入口，在 `scripts/targets.json` 登记同名目标，并在交付时注明。按任务范围决定是否接入 `showcase`。
- App 专属 Pixi HUD 和 Three.js 场景分别放在 `hud/` 和 `three/`，按实际模块建目录。
- Agent 新增或修改代码时，为源码里看不出的业务规则、平台限制和资源生命周期补必要注释。沿用项目措辞，说明具体原因，删掉复述代码的注释和模板套话。
- 应用之间禁止跨目录导入。实际共用的业务进入 `src/game/common/`，微信平台、渲染、输入和资源加载能力归 `src/framework/`。框架与业务的依赖方向见工作流。
- 通过 `startGame` 装配场景与 HUD，复用框架管理的 Canvas、WebGL 上下文、帧循环和输入分流。
- App 专属素材放在 `media/<app-id>/`，按 `packaged/` 和 `runtime/` 声明来源。通过构建生成 `dist/` 和当前目标的分包配置。
- App 首屏、场景和 HUD 交互按工作流使用 `npm.cmd run dev:web -- <app-id>` 在浏览器联调。AI 交付 `build:target` 产物，微信开发者工具内的验收由开发者负责。
- 代码或素材改动完成后，核对目标构建、全仓类型检查及自动回归。交付时记录当前构建目标、模拟器的待验路径，以及开发者已提供的模拟器、预览和真机结果。
