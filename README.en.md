# HtmlToMiniGame

[简体中文](README.md) · English

HtmlToMiniGame is a TypeScript project for porting interactive web prototypes to WeChat Mini Games. It uses Three.js (`three-platformize`) for 3D scenes and PixiJS for the HUD. A shared runtime manages the canvas, WebGL context, frame loop, and input routing. Each app can run independently in a browser preview or be built as a WeChat Mini Game.

## Quick start

### 1. Clone and install dependencies

Install Git and Node.js with npm. Node.js 22 is recommended. Then clone the repository from GitHub and install the project dependencies.

```sh
git clone https://github.com/DeathEyeX/HtmlToMiniGame.git
cd HtmlToMiniGame
npm ci
```

`npm ci` installs the runtime and build dependencies from the committed `package-lock.json`. It needs access to the npm registry or a complete local cache. The repository includes the framework and app source, so you can skip Git submodule initialization. If Windows PowerShell blocks `npm.ps1`, use `npm.cmd` in the commands below, for example `npm.cmd ci`.

### 2. Run in a browser

After installing dependencies, run these commands from the repository root. The repository includes the assets for `showcase`.

```sh
npm run build:list
npm run dev:web -- showcase
```

Open the local URL printed in the terminal. On the Showcase home screen, the blue arrow opens the workbench and the purple three-color button opens the 20-second color-matching game. The page reloads when existing source files or assets in the build change. Restart the preview after adding, removing, or renaming assets, or after changing the target configuration. Press `Ctrl+C` to stop the preview.

### 3. Run in WeChat DevTools

After installing dependencies, build the target from the repository root to generate its code and assets.

```sh
npm run build:target -- showcase
```

Import the repository root into WeChat DevTools as a Mini Game project. If your account lacks access to the configured AppID, choose a Mini Game AppID you can use during import, then click **Compile**. To switch apps, replace `showcase` in the command with the target ID, rebuild, and click **Compile** again. All targets share `dist/` and the build-managed subpackage entries in `game.json`. The browser preview builds in memory and can run alongside WeChat DevTools. [Local development and WeChat testing workflow (Chinese)](docs/AGENT_WORKFLOW.md#4-本地网页联调)

## Example apps

| Target | What it runs |
| --- | --- |
| `showcase` | Home screen with links to the workbench and color-matching game |
| `workbench` / `color-match` | Standalone workbench or 20-second color-matching game |
| `ocean-shelter` | Ship overview, interactive compartments, and a greenhouse transplanting station |
| `nohara-house` | Cartoon house with a draggable camera and selectable rooms |
| `drift-era` | Pixel-art floating shelter with multi-deck navigation and a radio repair mission |
| `tidal-harbor` | 3D scene with floating shelter, waterline, and seabed views |
| `saltwind-haven` | Modular floating platforms, animated water, and camera focus points for each area |
| `mad-water-haven` | Floating home with a submerged shelter and a dive view |
| `controls` / `pixi-ui` / `webgl2` | Basic input, PixiJS texture atlases and taps, and WebGL2 examples |
| `model-viewer` / `showcase-model` / `webgl2-model` | GLB/Draco model-loading examples that require a separately supplied `model.glb` |

Run `npm run build:list` for the full list. Running the three model examples requires a separately supplied `model.glb`. The browser preview uses `../WechatAssetServer/model.glb` when available. For WeChat, start the model asset server and set a URL the device can reach in `src/game/common/model-viewer/modelAsset.ts`. [Model setup (Chinese)](docs/ARCHITECTURE_AND_USAGE.md#32-启动模型联调)

## Project structure and extensions

| Path | Purpose |
| --- | --- |
| [`src/framework/`](src/framework/) | Platform adapters, shared rendering and input, and asset loading |
| [`src/game/apps/`](src/game/apps/) | App entry points, Three.js scenes, and PixiJS HUDs |
| [`src/game/common/`](src/game/common/) | Scenes, gameplay, and UI shared by multiple apps |
| [`media/`](media/) | HUD atlases, models, textures, and other source assets |
| [`scripts/targets.json`](scripts/targets.json) | Target entry points, WebGL modes, and asset declarations |

To add an app, use `startGame` in `src/game/apps/<app-id>/main.ts` to assemble the scene and HUD, then register the target under the same ID in `scripts/targets.json`. WebGL1 is the default. Set the target’s `renderer` field to select WebGL2. [Adding apps and assets (Chinese)](docs/ARCHITECTURE_AND_USAGE.md#5-新增应用和素材)

`packagedResources` ship in the main WeChat package, and `runtimeResources` ship in a WeChat subpackage by default. To build `ocean-shelter` with remote assets, host the contents of `media/ocean-shelter/runtime/` with the directory structure intact. Replace the example URL with your asset directory URL. [Runtime asset configuration (Chinese)](docs/ARCHITECTURE_AND_USAGE.md#运行时资源)

```sh
npm run build:target -- ocean-shelter --runtime-url https://assets.example.com/ocean-shelter/v1/
```

## Development checks and documentation

```sh
npm run typecheck
npm test
```

Local tools cover HTML prototype migration, headless browser startup, HUD touch bounds, and WeChat build auditing. [Local tools guide (Chinese)](docs/LOCAL_TOOLS.md)

Earlier documentation refers to this project as `PixiWechatTest`. Substitute your repository path for the local paths shown in those examples.

- [Framework architecture (Chinese)](docs/FRAMEWORK_ARCHITECTURE.md)
- [Architecture and usage guide (Chinese)](docs/ARCHITECTURE_AND_USAGE.md)
- [AI development conventions (Chinese)](AGENTS.md) · [App development workflow (Chinese)](docs/AGENT_WORKFLOW.md)
- [Development archive (Chinese)](docs/development/README.md) · [QA and troubleshooting (Chinese)](docs/QA.md)
