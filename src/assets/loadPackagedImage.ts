export function loadPackagedImage(path: string) {
  return new Promise<ReturnType<typeof wx.createImage>>((resolve, reject) => {
    const image = wx.createImage();
    const timer = setTimeout(() => finish(new Error(`Image load timed out: ${path}`)), 8_000);

    function finish(error?: Error) {
      clearTimeout(timer);
      image.onload = image.onerror = () => {};
      if (error) reject(error);
      else resolve(image);
    }

    image.onload = () => finish(image.width > 0 && image.height > 0
      ? undefined
      : new Error(`Image has invalid dimensions: ${path}`));
    image.onerror = () => finish(new Error(`Cannot load package image: ${path}`));
    try {
      image.src = path;
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
