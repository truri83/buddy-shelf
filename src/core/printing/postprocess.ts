/**
 * Aufbereitung für den Thermodruck: jedes Pixel wird reines Weiß, Schwarz oder Rot (#ff0000) –
 * genau das erwartet niimbluelibs ImageEncoder. Übernommen aus NiimBlue (src/utils/post_process.ts, MIT).
 */

export interface Pixels {
  data: Uint8ClampedArray;
}

export const DARK_THRESHOLD = 140;
export const RED_THRESHOLD = 100;

export function rgbToGray(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Schwarz/Weiß. Rot wird dabei schwarz (einfarbige Rolle). */
export function threshold<T extends Pixels>(image: T, dark = DARK_THRESHOLD): T {
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i + 3]! < 128 ? 255 : rgbToGray(d[i]!, d[i + 1]!, d[i + 2]!) < dark ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  return image;
}

/** Schwarz/Rot/Weiß für Zweifarbrollen. */
export function thresholdRedBlack<T extends Pixels>(image: T, dark = DARK_THRESHOLD, red = RED_THRESHOLD): T {
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b, a] = [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!];
    if (a < 128) {
      d[i] = d[i + 1] = d[i + 2] = 255;
    } else if (r - g > red && r - b > red) {
      d[i] = 255;
      d[i + 1] = 0;
      d[i + 2] = 0;
    } else {
      d[i] = d[i + 1] = d[i + 2] = rgbToGray(r, g, b) < dark ? 0 : 255;
    }
    d[i + 3] = 255;
  }
  return image;
}
