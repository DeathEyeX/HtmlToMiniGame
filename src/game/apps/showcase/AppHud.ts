import { Container, Graphics } from 'pixi.js';
import type { HudGesture } from '../../../framework/platform/WechatPlatform';
import type { HudView } from '../../../framework/ui/PixiHud';
import type { ModelStatus } from '../../common/model-viewer/types';
import { drawHomeHud } from './HomeHud';
import { toolbar } from './toolbarLayout';

type Point = Parameters<HudGesture['move']>[0];
export type ActivityView = HudView & { dispose(): void };
export type ModelHudRenderer = (buttons: Graphics, load: ModelStatus) => void;

interface Actions {
  openWorkbench(): Promise<void>;
  openColorMatch(): Promise<void>;
  openModel?(): Promise<void>;
  modelStatus(): ModelStatus | undefined;
  drawModel?: ModelHudRenderer;
  back(): void;
  retryModel(): void;
}

export function createAppHud(stage: Container, width: number, height: number, actions: Actions) {
  const panel = new Container();
  const { step, padding, size } = toolbar;
  const panelWidth = step * 5 + padding * 2;
  const panelHeight = size + padding * 2;
  const backdrop = new Graphics().roundRect(0, 0, panelWidth, panelHeight, 12).fill(0x102746);
  const buttons = new Graphics();
  panel.addChild(backdrop, buttons);
  stage.addChild(panel);
  let activity: ActivityView | undefined;
  let viewport = { width, height };

  function draw() {
    buttons.clear();
    const model = actions.modelStatus();
    if (!model) {
      drawHomeHud(buttons, Boolean(actions.openModel));
      return;
    }
    buttons.roundRect(padding, padding, size, size, 8).fill(0x304764)
      .moveTo(20, 28).lineTo(36, 28).moveTo(26, 22).lineTo(20, 28).lineTo(26, 34)
      .stroke({ color: 0xffffff, width: 2 });
    actions.drawModel?.(buttons, model);
  }

  function resize(width: number, height: number) {
    viewport = { width, height };
    activity?.resize(width, height);
    const scale = Math.min(1, width / panelWidth, height / panelHeight);
    panel.scale.set(scale);
    panel.position.set((width - panelWidth * scale) / 2, Math.max(0, height - panelHeight * scale - 24));
  }

  function buttonAt(point: Point) {
    const x = (point.x - panel.x) / panel.scale.x - padding;
    const y = (point.y - panel.y) / panel.scale.y - padding;
    const index = Math.floor(x / step);
    if (y < 0 || y >= size || index < 0 || index > 4 || x % step >= size) return;
    const model = actions.modelStatus();
    if (model) {
      if (index === 0 || (index === 4 && model.stage === 'error')) return index;
    } else if (index === 1 || index === 2 || (index === 4 && actions.openModel)) {
      return index;
    }
  }

  resize(width, height);
  draw();
  return {
    resize,
    refresh: draw,
    mountActivity(create: (stage: Container, width: number, height: number) => ActivityView) {
      activity = create(stage, viewport.width, viewport.height);
      panel.visible = false;
    },
    closeActivity() {
      activity?.dispose();
      activity = undefined;
      panel.visible = true;
    },
    beginGesture(point: Point): HudGesture | undefined {
      if (activity) return activity.beginGesture(point);
      const pressed = buttonAt(point);
      if (pressed === undefined) return;
      const modelWasOpen = Boolean(actions.modelStatus());
      let valid = true;
      return {
        move(next) { valid &&= buttonAt(next) === pressed; },
        release(next) {
          if (activity || !valid || Boolean(actions.modelStatus()) !== modelWasOpen || buttonAt(next) !== pressed) return;
          if (modelWasOpen) {
            if (pressed === 0) actions.back();
            else actions.retryModel();
            draw();
          } else {
            const open = pressed === 1 ? actions.openColorMatch : pressed === 2 ? actions.openWorkbench : actions.openModel;
            void open?.().then(draw);
          }
        },
        cancel() {}
      };
    }
  };
}
