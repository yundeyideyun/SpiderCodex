export function normalizedScreenWidth(value) {
  return Number.isFinite(value) && value > 0 && value <= 1 ? value : 1;
}
export function sceneScale(viewportWidth, screenWidthRatio=1) {
  return Math.max(0,Number(viewportWidth)||0)/1920*normalizedScreenWidth(screenWidthRatio);
}


// Two transparent layers span the whole virtual desktop. Keep each at most
// a 4K framebuffer, including high DPI and mixed-display configurations.
export function canvasResolution(width, height, deviceScale) {
  const maxPixels = 3840 * 2160;
  const maxSide = 8192;
  width = Math.max(1, width);
  height = Math.max(1, height);
  const scale = Math.min(deviceScale || 1, 2, maxSide / width,
    maxSide / height, Math.sqrt(maxPixels / (width * height)));
  const pixelWidth = Math.max(1, Math.floor(width * scale));
  const pixelHeight = Math.max(1, Math.floor(height * scale));
  return {pixelWidth, pixelHeight, scaleX: pixelWidth / width, scaleY: pixelHeight / height};
}
