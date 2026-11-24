import { createResourceLoader } from '../../../../framework/assets/createResourceLoader';

const packagedResources = createResourceLoader({
  kind: 'package',
  root: 'dist/resources/packaged/ocean-shelter'
});

export const oceanHudIconNames = ['panel', 'title', 'wood', 'steel', 'food', 'rooms', 'crew', 'roof', 'motion', 'overview'] as const;

export function loadOceanHudImages() {
  return Promise.all([
    packagedResources.loadImage('ui/ui-glyphs.png'),
    ...oceanHudIconNames.map(name => packagedResources.loadImage('ui/ui-' + name + '.png'))
  ]);
}
