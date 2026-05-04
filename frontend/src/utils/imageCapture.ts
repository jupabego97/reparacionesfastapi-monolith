const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.92;

/** Espera a que el video tenga dimensiones listas para pintar al canvas. */
export async function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState < 2) {
    await new Promise<void>(resolve => {
      const done = () => {
        video.removeEventListener('loadeddata', done);
        video.removeEventListener('canplay', done);
        resolve();
      };
      video.addEventListener('loadeddata', done);
      video.addEventListener('canplay', done);
    });
  }
  await new Promise<void>(resolve => {
    const tick = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });
}

/** Dibuja el frame del video en un canvas, redimensionando si el lado mayor supera MAX_EDGE. */
export async function captureVideoFrameToJpegBlob(video: HTMLVideoElement): Promise<Blob> {
  await waitForVideoFrame(video);
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw <= 0 || vh <= 0) {
    throw new Error('Video sin dimensiones válidas');
  }
  const max = Math.max(vw, vh);
  let tw = vw;
  let th = vh;
  if (max > MAX_EDGE) {
    const scale = MAX_EDGE / max;
    tw = Math.round(vw * scale);
    th = Math.round(vh * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');
  ctx.drawImage(video, 0, 0, tw, th);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('No se pudo codificar JPEG'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

/** Redimensiona imagen desde archivo (orientación EXIF vía createImageBitmap cuando el navegador lo permite). */
export async function imageFileToJpegBlob(file: File): Promise<Blob> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bmp = await createImageBitmap(file);
  }
  try {
    const w = bmp.width;
    const h = bmp.height;
    const max = Math.max(w, h);
    let tw = w;
    let th = h;
    if (max > MAX_EDGE) {
      const scale = MAX_EDGE / max;
      tw = Math.round(w * scale);
      th = Math.round(h * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible');
    ctx.drawImage(bmp, 0, 0, tw, th);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('No se pudo codificar JPEG'))),
        'image/jpeg',
        JPEG_QUALITY,
      );
    });
  } finally {
    bmp.close();
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Lectura de archivo fallida'));
    r.readAsDataURL(blob);
  });
}
