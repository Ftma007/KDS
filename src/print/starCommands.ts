// Turns a drawn sticker into Star printer commands. Star printers understand one of two
// "dialects"; Admin chooses which (settled on site with Test print):
//   starprnt    - StarPRNT raster image (ESC GS S), then feed and partial cut (ESC d 3).
//                 Default: the earlier test showed the printer accepts StarPRNT text.
//   stargraphic - Star Graphic raster mode (ESC * r ...), for printers in that mode.

export interface MonoBitmap { width: number; height: number; bytesPerRow: number; data: Uint8Array }

/** Black-and-white bitmap of a canvas, one bit per dot, left dot = high bit. */
export function toMonoBitmap(canvas: HTMLCanvasElement): MonoBitmap {
  const { width, height } = canvas;
  const px = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
  const bytesPerRow = Math.ceil(width / 8);
  const data = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (px[i + 3] > 127 && lum < 128) data[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { width, height, bytesPerRow, data };
}

const ESC = 0x1b, GS = 0x1d;

export function starPrntCommands(bm: MonoBitmap): Uint8Array {
  const out: number[] = [ESC, 0x40]; // initialise
  const CHUNK = 64; // rows per raster command
  for (let y0 = 0; y0 < bm.height; y0 += CHUNK) {
    const rows = Math.min(CHUNK, bm.height - y0);
    out.push(ESC, GS, 0x53, 0x01, bm.bytesPerRow & 0xff, bm.bytesPerRow >> 8, rows & 0xff, rows >> 8, 0x00);
    const start = y0 * bm.bytesPerRow;
    for (let k = 0; k < rows * bm.bytesPerRow; k++) out.push(bm.data[start + k]);
  }
  out.push(ESC, 0x64, 0x03); // feed to cut position, partial cut
  return Uint8Array.from(out);
}

export function starGraphicCommands(bm: MonoBitmap): Uint8Array {
  const out: number[] = [];
  out.push(ESC, 0x2a, 0x72, 0x52); // initialise raster mode
  out.push(ESC, 0x2a, 0x72, 0x41); // enter raster mode
  out.push(ESC, 0x2a, 0x72, 0x50, 0x30, 0x00); // page length 0 (continuous)
  out.push(ESC, 0x2a, 0x72, 0x45, 0x31, 0x33, 0x00); // end-of-job: feed and cut
  for (let y = 0; y < bm.height; y++) {
    out.push(0x62, bm.bytesPerRow & 0xff, bm.bytesPerRow >> 8);
    const start = y * bm.bytesPerRow;
    for (let k = 0; k < bm.bytesPerRow; k++) out.push(bm.data[start + k]);
  }
  out.push(ESC, 0x0c, 0x00); // end of page (runs the end-of-job cut)
  out.push(ESC, 0x2a, 0x72, 0x42); // leave raster mode
  return Uint8Array.from(out);
}

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
