/**
 * photo.js — Photo compression before localStorage storage
 *
 * Phone cameras produce 3-5MB base64 images. localStorage has a ~5MB limit.
 * This utility downscales photos to maxWidth (default 800px) and re-encodes
 * as JPEG at 0.7 quality, typically reducing size to ~100-200KB.
 *
 * Returns a Promise because Image.onload is async.
 */

export function resizePhoto(base64, maxWidth = 800) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Don't upscale small images
      if (img.width <= maxWidth) {
        resolve(base64);
        return;
      }
      const scale = maxWidth / img.width;
      const canvas = document.createElement("canvas");
      canvas.width = maxWidth;
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => resolve(base64); // fallback to original on error
    img.src = base64;
  });
}
