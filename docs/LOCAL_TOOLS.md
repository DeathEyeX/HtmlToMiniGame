# 本地开发工具

## 从 HTML 原型迁移

在仓库根目录执行。默认输出 JSON 迁移报告。报告包含脚本入口、静态素材引用、模块清单，以及需要处理的文件和行号。

~~~powershell
npm.cmd run migrate:html -- D:/Prototypes/my-scene/index.html
npm.cmd run migrate:html -- D:/Prototypes/my-scene/index.html --config D:/Prototypes/my-scene/migration.json --apply
~~~

自动生成适用于一个 `<script type="module">` 入口。脚本可以内联 JavaScript，或引用同目录下的 JS、MJS 或 TS 模块。入口使用 `export function createScene` 声明场景工厂。框架依次提供场景、渲染器和 Canvas，工厂返回至少包含 `camera` 和 `update(delta)` 的对象，也可返回 `resize`、`touch` 和 `dispose`。工具会保留可解析的本地模块及相对路径，并映射 `three` 和 Three.js addons 的导入。类型检查会提示目标 Three.js 版本的 API 差异。

~~~html
<!doctype html>
<canvas></canvas>
<script type="module">
  import { PerspectiveCamera, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';

  export function createScene(scene) {
    const camera = new PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 4;
    const geometry = new BoxGeometry();
    const material = new MeshBasicMaterial({ color: 0x6688cc });
    const cube = new Mesh(geometry, material);
    scene.add(cube);
    return {
      camera,
      update(delta) { cube.rotation.y += delta; },
      dispose() { geometry.dispose(); material.dispose(); }
    };
  }
</script>
~~~

CSS 会出现在报告中，HTML 控件、浏览器专属调用和额外渲染器会报告迁移错误。先将控件适配到 Pixi HUD，并把帧循环与输入交给框架。生成后可以在 App 的 `hud/` 中接入已有的 HUD 装配方式。 [App 装配约定](AGENT_WORKFLOW.md#2-按归属装配代码)

可选配置文件包含以下字段。目录相对于原型 HTML，资源路径会保留。

~~~json
{
  "id": "my-scene",
  "renderer": "webgl1",
  "packagedResources": "assets/ui",
  "runtimeResources": "assets/scene"
}
~~~

指定素材目录后，第四个工厂参数会提供相应的 `resources.packaged` 或 `resources.runtime` 加载器，它们支持 `loadImage` 和 `readBinary`。运行时资源默认走微信分包，使用现有的 `--runtime-url` 构建参数可改走远程地址。未提供 ID 时，从 HTML 文件名推导，`index.html` 使用所在目录名。

`--apply` 生成独立 App 并在 `scripts/targets.json` 登记。入口通过类型检查和内存打包后才提交登记。若目标已存在，换一个 ID 后重新执行。生成后可直接联调和构建。

~~~powershell
npm.cmd run dev:web -- my-scene
npm.cmd run build:target -- my-scene
~~~

## 无头浏览器检查

检查使用 `dev:web` 的同一套入口、渲染器和素材清单。安装 npm 依赖后可使用本机的 Edge 或 Chrome。需要独立浏览器时，可执行 `npx playwright-core install chromium`。

~~~powershell
npm.cmd run test:browser -- nohara-house
npm.cmd run test:browser -- ocean-shelter --device phone --browser msedge
~~~

默认检查 `phone`（390 × 844）和 `desktop`（960 × 540）。还可用 `--device compact` 检查 320 × 568 视口，参数可重复。工具等待 Three 和 Pixi 完成首帧，记录页面异常、加载失败和浏览器警告，并写入 `.build/browser-check/` 下本次运行的 `report.json` 和截图。检查失败返回非零退出码。小程序端的启动、触摸和平台资源加载仍需在微信开发者工具和真机验收。

### HUD 触摸区域

~~~powershell
npm.cmd run test:browser -- nohara-house --hud --device compact --device phone --device desktop
~~~

`--hud` 在报告中补充控件 ID、文字和触摸区域。已接入的 App 通过 `HudView.inspectControls` 返回当前可交互控件，坐标使用与 `beginGesture` 相同的逻辑视口单位。手机视口额外使用一个固定的模拟胶囊矩形。越界、重复 ID、胶囊遮挡和无意重叠判为失败，短边小于 32 CSS 像素给出提示。需要有意重叠的控件可设为同一 `overlapGroup`。

`nohara-house` 已接入。扩展其他 HUD 时，从实际触摸命中代码使用的布局数据计算坐标。检查构建才会开启截图与 HUD 数据入口。

## 微信构建报告

~~~powershell
npm.cmd run build:report -- ocean-shelter
npm.cmd run build:report -- ocean-shelter --runtime-url https://assets.example.com/ocean-shelter/v1/
~~~

输出 JSON，包含主包、目标管理的分包、远程资源、大文件和 bundle 模块归属。统计采用原始字节，覆盖选中目标生成的文件和微信启动入口，上传体积以微信开发者工具包分析为准。

报告会检查可静态识别的 `loadImage`、`readBinary` 调用和直接方法别名，也会读取 GLB／glTF 的 JSON 检查外部图片和缓冲区路径。运行时拼接的参数和外部 URL 会列为待核对项。远程模式检查本地源目录的文件清单。已部署站点上的资源仍通过真机加载验证。

构建报告在内存中生成，`build:target` 用于实际输出小游戏项目。
