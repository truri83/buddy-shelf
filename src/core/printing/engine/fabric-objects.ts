/**
 * Fabric-Objekte aus NiimBlue (src/fabric-object/qrcode.ts, textbox-ext.ts; MIT, © MultiMote),
 * auf das Rendern reduziert. Sie müssen unter denselben Typnamen registriert sein, damit
 * NiimBlue-Vorlagen geladen werden können.
 */
import * as fabric from 'fabric';
import QRCodeFactory from 'qrcode-generator';

type Ecl = 'L' | 'M' | 'Q' | 'H';
type Mode = 'Numeric' | 'Alphanumeric' | 'Byte' | 'Kanji';

// UTF-8 für Umlaute in QR-Inhalten (NiimBlue src/utils/qrcode.ts)
function toUTF8Array(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0xd800 || c >= 0xe000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else {
      i++;
      c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return out;
}
(QRCodeFactory as unknown as { stringToBytes: (s: string) => number[] }).stringToBytes = toUTF8Array;

function renderError(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 4;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

export class QRCode extends fabric.FabricObject {
  static override readonly type = 'QRCode';
  declare text: string;
  declare ecl: Ecl;
  declare mode: Mode;
  declare qrVersion: number;

  constructor(options?: Record<string, unknown>) {
    super();
    Object.assign(this, { text: '', ecl: 'M', mode: 'Byte', qrVersion: 0, stroke: '#000000', fill: '#ffffff' });
    this.setOptions(options ?? {});
  }

  override _set(key: string, value: unknown): this {
    super._set(key, value);
    if (key === 'text' || key === 'ecl') this.dirty = true;
    return this;
  }

  override _render(ctx: CanvasRenderingContext2D): void {
    if (!this.text) return renderError(ctx, this.width, this.height);
    // qrVersion 0 = automatisch
    const qr = QRCodeFactory((this.qrVersion || 0) as TypeNumber, this.ecl);
    try {
      qr.addData(this.text, this.mode);
      qr.make();
    } catch {
      return renderError(ctx, this.width, this.height);
    }
    // ganzzahlige Modulgröße → scharfe Kanten ohne Kantenglättung
    const scale = Math.floor(this.width / qr.getModuleCount());
    let size = scale * qr.getModuleCount();
    size -= size % 2;
    if (scale < 1 || size > this.width) return renderError(ctx, this.width, this.height);
    ctx.save();
    ctx.translate(-size / 2, -size / 2);
    ctx.translate(-0.5, -0.5);
    qr.renderTo2dContext(ctx, scale);
    ctx.restore();
  }

  override toObject(propertiesToInclude: string[] = []) {
    return super.toObject(['text', 'ecl', 'mode', 'qrVersion', ...propertiesToInclude] as never[]);
  }
}

/** Textbox mit `fontAutoSize`: Schrift schrumpft, bis der Text in die Breite passt. */
export class TextboxExt extends fabric.Textbox {
  declare fontAutoSize: boolean;

  constructor(text: string, options?: Record<string, unknown>) {
    super(text, options);
    this.fontAutoSize = Boolean(options?.fontAutoSize);
  }

  /** Text setzen und verkleinern, bis Breite und Zeilenzahl passen (NiimBlue setAndShrinkText). */
  setAndShrinkText(text: string, maxWidth: number, maxLines?: number) {
    const limit = maxLines ?? this._splitTextIntoLines(this.text).lines.length;
    this.set({ text });
    let lines = this._splitTextIntoLines(text).lines.length;
    while ((lines > limit || this.width > maxWidth) && this.fontSize > 2) {
      this.fontSize -= 1;
      this.set({ text, width: maxWidth });
      lines = this._splitTextIntoLines(text).lines.length;
    }
  }
}

let registered = false;
export function registerFabricObjects() {
  if (registered) return;
  fabric.classRegistry.setClass(QRCode, 'QRCode');
  fabric.classRegistry.setClass(TextboxExt, 'Textbox');
  registered = true;
}
