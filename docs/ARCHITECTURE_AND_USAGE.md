# PixiWechatTest 架构与使用指南

核对日期为 2026-11-23。这里描述当前工程的 TypeScript 入口、构建模式、平台适配、UI 扩展和验收流程。[目标架构与实施路线](FRAMEWORK_ARCHITECTURE.md) · [迁移与交接](PROJECT_STATUS_AND_AGENT_HANDOFF.md) · [QA 与故障处理记录](QA.md)

## 1. 当前基线

每个应用有自己的 TypeScript 入口。构建按 `scripts/targets.json` 选一个入口，由 esbuild 生成 ES2019 IIFE。3D 基线是 `three-platformize@1.133.3` 与 WebGL1，2D 采用 `pixi.js@8.23.0` 的 Graphics、Container、Sprite 和 BitmapText。微信固定通过 `game.js` 加载 `dist/game.bundle.js`。

| 目标 | 命令 | 运行结果 | JS 字节数 |
| --- | --- | --- | ---: |
| `controls` | `npm.cmd run build` | 立方体与 Pixi 操作面板 | 1,046,357 |
| `model-viewer` | `npm.cmd run build:model` | Littlest Tokyo、Toon、动画和 Pixi 操作面板 | 1,757,074 |
| `showcase` | `npm.cmd run build:app` | 首页、配装台、颜色匹配与场景往返 | 1,105,898 |
| `showcase-model` | `npm.cmd run build:app:model` | 集成首页同时提供模型、进度和重试 | 1,818,233 |
| `webgl2` | `npm.cmd run build:webgl2` | WebGL2 原生探针、立方体和 Pixi HUD | 1,049,132 |
| `webgl2-model` | `npm.cmd run build:webgl2:model` | WebGL2 原生探针、Littlest Tokyo 和 Pixi HUD | 1,759,989 |
| `pixi-ui` | `npm.cmd run build:ui` | Sprite、BitmapText 和触摸计数 | 1,092,080 |
| `workbench` | `npm.cmd run build:workbench` | 直接进入配装台 | 1,097,366 |
| `color-match` | `npm.cmd run build:color-match` | 直接进入颜色匹配 | 1,095,122 |

九个目标都通过 ES2019 解析。`showcase`、`showcase-model`、`pixi-ui`、`workbench` 和 `color-match` 各生成一个 402 字节 PNG。`showcase` 的 bundle 排除模型 HUD、GLB／Draco 和 WebGL2 探针。每次构建替换 `dist/`，微信工具运行最后一次构建的目标，实际预览包大小由微信工具显示。

`npm.cmd run build:list` 列出目标及文件。`npm.cmd run build:target -- <目标名>` 检查该目标的 TypeScript 依赖并构建。全仓类型检查使用 `npm.cmd run typecheck`，自动验证使用 `npm.cmd test`。

## 2. 运行架构

```text
npm run build       → 立方体排错
npm run build:model → 模型回归
npm run build:app   → 首页、配装台及颜色匹配
npm run build:app:model → 首页、配装台及 Littlest Tokyo
                           ↓
    scripts/targets.json → 选定应用入口 → esbuild → dist/game.bundle.js ← game.js
                           ↓
          runtime/startGame.ts → wx.createCanvas → WechatPlatform
                           ↓
   Cube.ts / LittlestTokyo.ts / Workbench.ts → Three 场景 / 相机 / OrbitControls
                           ↓
           同一上屏 Canvas 和同一 WebGL1 上下文
                           ↓
                每帧先绘制 3D，再绘制 Pixi HUD

模型分支
wx.downloadFile / 版本缓存 → ArrayBuffer → GLTFLoader.parse
  → WechatDracoLoader → 几何 / 内嵌纹理 → Toon 材质和 AnimationMixer
```

| 模块 | 职责与依赖 |
| --- | --- |
| `game.js`、`game.json`、`project.config.json` | 微信入口、竖屏、小游戏项目和打包规则。保持 `es6: false`，由 esbuild 提供兼容语法。源码、测试、文档和归档的 `libs/` 由打包规则排除。 |
| `src/game/apps/`、`scripts/targets.json` | 每个目标指定一个应用入口。入口组装场景和 HUD，脚本负责构建和素材清单。 |
| `src/framework/runtime/startGame.ts` | 持有 Canvas、平台、渲染器、HUD、RAF、尺寸与前后台处理。绘制顺序为 Three 后叠加 Pixi。 |
| `src/game/apps/webgl2/webGL2.ts` | 在同一上屏 Canvas 请求 WebGL2，编译 GLSL ES 3.00 并绘制和读回像素。确认后给 Three 提供上下文，记录真实版本、模板缓冲及初始化结果。 |
| `src/game/common/three/Cube.ts` | 构建程序化立方体，以及独立的相机、灯光和旋转更新。 |
| `src/game/apps/showcase/startGameApp.ts`、`AppHud.ts` | 应用导航和 HUD 装配。按需载入场景和 UI，调用运行时 `switchScene` 进入和返回。 |
| `src/game/common/workbench/`、`src/game/common/color-match/` | 各自持有 3D、UI 与业务数据。颜色匹配以纯逻辑模块 `round.ts` 管理计分和回合。 |
| `src/game/common/model-viewer/LittlestTokyo.ts` | 持有模型相机、灯光、动画和当前加载尝试。对应用提供状态、重试与退出释放，通过 `update(delta)` 接入共享帧循环。 |
| `src/framework/platform/WechatPlatform.ts` | 继承已验证的 `WechatGamePlatform`。沿用其微信原生触摸订阅，仅在手势开始时询问 HUD 是否接管按钮、开关、滑块或拖动把手。起点在场景的手势走原 OrbitControls。 |
| `src/framework/ui/loadHud.ts` | 在延迟加载 Pixi 之前补齐缺失的 `navigator` 和 `performance.now()`。构建把 Pixi 的裸 `performance`、`Intl` 引用映射到对应的 `globalThis` 属性。 |
| `src/framework/ui/PixiHud.ts` | 配置微信 Canvas 适配，使用 Pixi 的静态代码兼容模块。由调用方提供 HUD 视图，经 `beginGesture` 返回 `move / release / cancel`。 |
| `src/game/common/ui/controlsHud.ts` | 计数、开关、滑块、遮罩和整板拖动，由基础操作、模型与 WebGL2 目标复用。 |
| `src/game/common/ui/packagedUIAtlas.ts`、`src/framework/assets/loadPackagedImage.ts` | 以 `wx.createImage` 解码包内图集，提供共用纹理和位图数字。BitmapText 扩展在渲染器初始化前注册。配装台首入时请求图集，成功后在应用存活期间复用。 |
| `src/framework/assets/model/`、`src/game/common/model-viewer/modelAsset.ts` | 场景提供 URL、缓存键和版本。通用加载器通过 `wx.downloadFile` 及微信文件系统验证 GLB 头、长度和解析结果。缓存按 `<cacheKey>-<version>.glb` 存储在 `wx.env.USER_DATA_PATH/three-model-cache`。解析失败的缓存尝试删除，下一次重试跳过该条缓存。 |
| `src/framework/assets/model/draco/WechatDracoLoader.js`、`src/framework/assets/model/draco/draco_decoder.js` | 适配版 GLTFLoader 接口、纯 JS 解码、顶点属性和索引生成及临时对象释放。模型正常路径无需 Worker 或单独的 WASM 文件。 |
| `src/game/common/model-viewer/AnimeToonMaterial.js` | 将适用的模型材质转换为 Toon，保留基础贴图，使用 WebGL1 兼容的 `LuminanceFormat` 渐变纹理。 |

**渲染边界。** 入口创建上屏 Canvas，先绘制 Three，再重置状态并叠加 Pixi。Pixi 绘制时关闭清屏。业务首屏导航由 Graphics 绘制，BitmapText 扩展随业务 HUD 注册，图片留到配装台首入时解码。输入由微信触摸桥处理。新增 UI 扩展时先验证相关平台能力，尤其是 Text 的 Canvas 纹理、图片解码和联调包大小。

**手势归属。** 控件在初次按下时完成命中。命中控件后，平台持续交给同一个手势处理器，直到释放或取消。坐标超出控件仍可用于面板移动和滑块更新，点按控件则会在拖出后取消激活。模型手势从 3D 区域开始后，即使经过控件，也继续交给场景。当前接入验证的是 Pixi 渲染与微信侧手势管理，Pixi 自带的事件系统及浏览器 DOM 输入属于额外能力。

## 3. 安装与运行

### 3.1 在微信开发者工具运行最小模式

```powershell
Set-Location 'D:\Project\Web\ThreeJsTest\PixiWechatTest'
npm.cmd ci
npm.cmd test
npm.cmd run build
```

1. 在微信开发者工具导入该工程根目录，使用小游戏模式和有项目权限的微信账号。启动后点击「编译」验证立方体和面板。
2. 如果新编译后所有模拟器输入都失效，关闭当前工程窗口并重新打开同一项目。在 Stable 1.06.2402030 的既有异常会话中已经用同一业务包做过对照，重开恢复了点击和拖动。

新的开发机执行 `npm ci` 时需要能访问配置的 npm 源或有完整本地缓存。审查环境使用 Node 22.18.0 和 npm 11.5.2。

### 3.2 启动模型联调

在单独终端运行资源服务器：

```powershell
Set-Location 'D:\Project\Web\ThreeJsTest'
python -m http.server 8080 --bind 0.0.0.0 --directory '.\WechatAssetServer'
```

确认该目录下有 `model.glb`。现有资源与网页原型的 `littlest-tokyo-vite/public/models/LittlestTokyo.glb` 字节相同。用 `ipconfig` 核对手机可达的网卡 IP，必要时更新 `src/game/common/model-viewer/modelAsset.ts` 中 `littlestTokyoAsset.url`。当前配置为 `http://192.168.1.46:8080/model.glb`。换模型或换资源来源时一起更新 `version`，以便重新下载。

```powershell
Set-Location 'D:\Project\Web\ThreeJsTest\PixiWechatTest'
npm.cmd run build:model
```

在开发者工具点击「编译」。正常日志包括 `[ThreeDraco] Renderer initialized`、`[PixiHUD] clock-bridge-v2 function`、`Pixi HUD initialized`、`Resource ready`、`GLB parsed` 和 `Scene ready`。现有模型回归的参考值是 71 个网格、193,125 个顶点与 1 段动画。HUD 日志和模型日志可以交错出现。

### 3.3 真机预览与日志定位

- **局域网联调**使用同一网络的电脑和手机，确保模型服务器持续运行。开发者生成新预览二维码，按需要开启手机端开发者调试。局域网调试和免调试的发布环境分别记录。
- **公开资源联调**需要项目实际的 HTTPS 模型地址和为 AppID 登记的 `downloadFile` 合法域名。更换模型缓存版本，在手机关闭开发者调试时复测冷下载，再次进入验证热缓存。详细流程见[交接文档真机预览](PROJECT_STATUS_AND_AGENT_HANDOFF.md#74-关闭调试的普通扫码验收)。
- **模型可见但 UI 缺失**时检查 `clock-bridge-v2`，随后记录 HUD 初始化或渲染的第一条错误。
- **UI 可见但模型缺失**时对照 `Resource ready`、`GLB parsed` 和服务端 GET。命中缓存时服务器不会收到 GET。资源已就绪但解析持续等待时，检查 Draco 错误。
- **工具能看到模型和 UI，但所有输入失效**时按 §3.1 重开项目并复测。记录 IDE 版本、基础库及是否重开即可恢复。

### 3.4 框架内部拆分验收

执行 `npm.cmd run build:app` 后在开发者工具点击「编译」。本模式无需模型服务器。

1. 首页应显示旋转立方体，底部有紫色三色按钮和蓝色右箭头。点蓝色箭头进入配装台。
2. 首次进入后，三个色块应显示位图编号 `01`、`02`、`03`，日志应出现一次 `[App] Workbench palette ready`。点色块，几何模型应立即换色，当前色块有白边。点右侧对勾，模型开始旋转，按钮显示确认状态。面板外拖动可转视角。
3. 点左箭头返回，再进入。首页隐藏配色选项，重进恢复初始颜色和未确认状态，并复用已解码的同一张图集。快速重复点入口只进入一次。切后台再返回，检查视角、帧循环与触摸。
4. 若图片仍在加载或加载失败，原有矢量色块仍可选色和确认。失败时查找 `[App] Workbench uses Graphics swatches`，核对 `dist/resources/pixi-ui-probe.png` 是否进入项目包。

执行 `npm.cmd run build:workbench` 后会直接进入同一配装台，底部提供配色和确认。旋转视角、重新编译后状态初始化也可用此入口复验。

当前该业务演示同首屏一起输出到现有 bundle。源码边界已拆开，物理 JS 文件拆分与微信官方分包按单文件、主包和首屏测量结果后置。

### 3.5 首页与模型联合验收

启动 §3.2 的资源服务器，执行 `npm.cmd run build:app:model`，在微信工具重新编译。首页保留配装台的蓝色箭头，最右侧绿色楼群打开模型。进入前可观察服务器无模型请求。

1. 使用新测试版本验证冷加载。进入时可见进度，模型就绪后进度条变为绿色。核对日志的 71 个网格、193,125 个顶点和 `Take 001`，拖动验证视角。
2. 放慢下载后点击左箭头。确认返回首页后立方体、配装台和触摸正常，模型加载中或解析中途退出后无迟到画面。下载在途调用微信下载任务的 `abort`，已开始的同步解码会完成当前计算。
3. 用新缓存版本并停止服务，或让测试地址返回非 200。模型失败应提示重试或返回。恢复服务后点重试，等待 `Scene ready` 及 `Cache saved`。返回并再次打开应出现 `Cache hit`，无需下载同版本模型。
4. 验证从已加载模型返回首页后色调恢复，配装台仍可换色和确认。最终复测开发者工具及真机，并记录终端和基础库版本。

### 3.6 WebGL2 专项诊断

先用 `npm.cmd run build:webgl2`。这个构建使用程序化立方体和已有 Pixi HUD，可在停止模型服务器的情况下验证。探针始终请求 WebGL2，失败会显示诊断提示。正式应用基线继续使用 WebGL1。

1. 在微信工具重新编译，在目标 iOS、Android 分别重新扫码。记录系统、微信、基础库、`[WebGL2] Environment` 及实际运行模式。同一手机的普通模式和高性能模式如均需覆盖，分别记录。
2. 检查 `Native context`、`Native draw verified`、`Three WebGL version 2` 和 `Pixi WebGL version 2`。首帧有 `GL_NO_ERROR` 后，再检查立方体、计数按钮、拖动、滑块、遮罩和前后台恢复。模板缓冲实测值和遮罩画面一并记录。
3. 前述通过后启动模型服务器，切换到 `npm.cmd run build:webgl2:model`。检查模型、内嵌贴图、Toon、动画和 Pixi 同屏。模型日志应有 71 个网格、193,125 个顶点及 `Take 001`。当前已测样本使用 `RedFormat` 梯度走 WebGL2 的 R8 纹理路径，WebGL1 模型继续用原 `LuminanceFormat`。设备出现黑屏、贴图或遮罩异常时，提供最先缺失的阶段日志和首条 GL 错误。
4. 恢复正式回归时执行 `npm.cmd run build:app:model` 并重新编译。通过一个平台的诊断只证明该设备和当前微信运行模式。

原生探针编译 GLSL ES 3.00、使用顶点数组并校验绘制结果。Three 与 Pixi 各自识别共享上下文版本。两者叠加使用同一个 Canvas，Pixi 遮罩需检查实际模板缓冲。[WebGL2 规范](https://registry.khronos.org/webgl/specs/latest/2.0/) · [Pixi 共享上下文指南](https://pixijs.com/8.x/guides/third-party/mixing-three-and-pixi)

### 3.7 Pixi UI 专项诊断

执行 `npm.cmd run build:ui` 后在微信工具点「编译」，无需模型服务器。诊断复用 WebGL1、共享 Canvas 和原生触摸分流。配装台和诊断共用一张 402 字节的包内 PNG，提供 Sprite 和预渲染数字字形。业务构建的 JS 依赖图排除 UI 探针。

1. 确认立方体与左上 HUD 同屏。HUD 左侧是四色 Sprite，右侧顶部显示 `012345`。
2. 点蓝色加号，数字应变成 `012346`。按下后拖出并释放时数字保持原值。从面板外拖动应旋转立方体。
3. 调整视口或切后台再返回，确认字体、图像与按钮的显示和命中一致。手机扫码后对照同一用例。记录工具、微信、设备、基础库及首条异常。
4. 日志 `[PixiUI] Package image decoded` 表示已读取包内 PNG，`Sprite and BitmapText mounted` 表示已挂载场景树。以屏幕上的四色块、数字及点击变化分别确认纹理和刷新。加载失败时检查项目导入目录、包分析中的 `dist/resources/pixi-ui-probe.png` 和首条 HUD 错误。

真机出现 `ReferenceError: Intl is not defined` 时，确认重新构建并生成新预览码。构建把 Pixi 的 `Intl` 引用映射到 `globalThis.Intl`，宿主缺少该 API 时由 Pixi 按 Unicode 码点分割文字，覆盖本样例的数字。宿主有原生 `Intl.Segmenter` 时继续使用原生实现。

诊断用 `wx.createImage` 加载本地图片，交给显式的 Pixi `ImageSource`。在创建 Pixi 渲染器前注册 BitmapText 扩展，数字共用图集。此样例覆盖预渲染的十个阿拉伯数字。Canvas 动态文字、中文字体、长列表按业务需要分别验收。[Pixi BitmapText 指南](https://pixijs.com/8.x/guides/components/scene-objects/text/bitmap) · [Pixi 纹理指南](https://pixijs.com/8.x/guides/components/textures)

### 3.8 颜色匹配场景验收

执行 `npm.cmd run build:app`，重新编译。无需模型服务器。

执行 `npm.cmd run build:color-match` 可直接进入同一玩法。用集成首页版本复验返回和重进。

1. 点首页底部紫色三色按钮。确认 Three 几何体、上方时钟和星标、底部播放按钮可见。点播放，出现三个颜色选项。
2. 点与 3D 物体同色的按钮，分数加一，物体换色。点错色、按住拖出后释放、从 3D 区域拖动视角均不加分。
3. 切后台数秒再回前台，倒计时延续切出时的进度。计时使用运行时提供的前台帧步长。到零时，白色重开箭头应完整位于蓝色按钮内。点重开后分数归零、时间回到 `20`。
4. 点左箭头回首页，再次进入应停在待开始状态。再打开配装台，确认同一图集的数字色块仍正常。记录微信开发者工具、手机与基础库，遇到失败保留首条日志。

## 4. UI 验收和扩展

开发者负责微信开发者工具及手机上的交互验收，Agent 负责实现、类型检查、自动测试和构建。失败时保留设备、微信和基础库版本，连同操作、期望、实际表现及首条相关日志回传。

| 用例 | 可重复的验收动作 |
| --- | --- |
| 计数与释放 | 蓝色 `+` 按钮内按下并释放，计数加一。按住拖出后释放，计数与视角保持原样。 |
| 开关 | 点右侧开关两次，底部彩条隐藏后恢复。 |
| 连续值 | 拖动滑块，数值在 0–100 内连续变化，彩条透明度跟随。 |
| 遮罩 | 彩条只在底部预览槽内显示，拖动整个面板后仍按新位置裁剪。 |
| 拖动与命中 | 拖动顶部双线把手，面板与所有子控件一起移动。放下后在新位置点击 `+`，计数继续增加。 |
| 3D 输入隔离 | 在面板外开始拖动，模型视角旋转，面板位置与计数保持原样。 |

开发者曾确认首页与模型联合构建、WebGL2 专项、Pixi UI 的 `Intl` 修复及配装台 UI。独立入口迁移后的本地基线包含 21 项自动回归、九种构建、依赖及素材隔离检查。当前产物的微信端验收由开发者执行。

新增控件时在 HUD 内定义视觉、命中区域和状态更新，单击动作在 `release` 内提交，拖动控件在 `move` 内更新，取消时恢复临时交互状态。

## 5. 新增应用和素材

1. 在 `src/game/apps/<项目名>/` 新建 `main.ts`，组织自己的场景与 HUD。单场景可参考 `apps/color-match/main.ts`，带多页面的应用可参考 `apps/showcase/`。场景工厂返回相机、OrbitControls、`update(delta)` 和资源释放函数。
2. 在 `scripts/targets.json` 登记目标。只需入口，使用包内素材时才添加 `assets`。

   ```json
   "first-game": { "entry": "src/game/apps/first-game/main.ts" }
   ```

3. 运行 `npm.cmd run build:target -- first-game`，导入工程根目录并编译。命令显示实际入口、bundle 字节数与随包资源。新增的目标可通过 `npm.cmd run build:list` 查到。

最小 Three 与 Pixi 入口可这样编写。`hud.ts` 导出 `CreateHudView` 类型的 `createHud`，在自己的绘制逻辑中使用 Pixi。

```ts
import { startGame } from '../../../framework/runtime/startGame';
import { createCubeScene } from '../../common/three/Cube';

void startGame((scene, _renderer, canvas) => createCubeScene(scene, canvas), {
  tag: '[FirstGame]',
  hudReadyMessage: 'Ready',
  showHudErrorModal: true
}, async () => (await import('./hud')).createHud);
```

```ts
// hud.ts
import { Graphics } from 'pixi.js';
import type { CreateHudView } from '../../../framework/ui/PixiHud';

export const createHud: CreateHudView = (stage) => {
  stage.addChild(new Graphics().circle(32, 32, 12).fill(0x147b6e));
  return { resize() {}, beginGesture() { return undefined; } };
};
```

把小图放在 `media/`，在目标的 `assets` 中填写相对路径，如 `first-game/panel.png`，运行时用 `dist/resources/first-game/panel.png` 加载。构建仅复制所选目标的素材并重新生成 `dist/`。把多个应用实际共用的业务模块按功能放入 `src/game/common/`。HUD 通过延迟导入注册扩展，保留微信环境初始化顺序。

## 6. 当前产物和发布验收

当前产物为 `build:app`。先按 §3.4 和 §3.8 在微信工具及手机回归配装台和颜色匹配，再用两个独立构建验证直接进入场景，新包图集应从 `dist/resources/` 读取。

按 §3.5 使用联合模型构建验收 Draco、缓存与返回。正式普通预览需要项目 AppID 已登记的 HTTPS 下载域名。微信工具生成预览前，记录构建目标、主包字节数与最大文件，手机记录系统、微信、基础库、首屏时间和模型首入时间。[框架审核](FRAMEWORK_ARCHITECTURE.md) · [普通预览验收](PROJECT_STATUS_AND_AGENT_HANDOFF.md#74-关闭调试的普通扫码验收)
