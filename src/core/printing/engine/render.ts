import * as fabric from 'fabric';
import { threshold, thresholdRedBlack } from '../postprocess';
import { fillVariables, type LabelTemplate, type LabelVariables } from '../template';
import { QRCode, TextboxExt, registerFabricObjects } from './fabric-objects';

export interface RenderOptions {
  /** Rot erhalten (Zweifarbrolle + Drucker kann Rot); sonst wird Rot schwarz */
  twoColor: boolean;
}

/**
 * Rendert eine Vorlage mit einem Datensatz in Druckerauflösung und bereitet sie auf reines
 * Weiß/Schwarz(/Rot) auf. Das Ergebnis dient für Vorschau, PNG und Druck – identisch.
 * Ablauf wie NiimBlue PrintPreview.generatePreviewData.
 */
export async function renderLabel(template: LabelTemplate, vars: LabelVariables, opts: RenderOptions): Promise<HTMLCanvasElement> {
  registerFabricObjects();
  const { width, height } = template.label.size;
  const canvas = new fabric.StaticCanvas(undefined, { width, height, backgroundColor: '#ffffff', enableRetinaScaling: false });
  try {
    await canvas.loadFromJSON(template.canvas);
    for (const obj of canvas.getObjects()) {
      if (obj instanceof TextboxExt) {
        const text = fillVariables(obj.text ?? '', vars);
        if (obj.fontAutoSize) obj.setAndShrinkText(text, obj.width);
        else obj.set({ text });
      } else if (obj instanceof fabric.IText || obj instanceof QRCode) {
        obj.set({ text: fillVariables((obj as { text?: string }).text ?? '', vars) });
      }
    }
    canvas.renderAll();
    const out = canvas.toCanvasElement(1);
    const ctx = out.getContext('2d', { willReadFrequently: true })!;
    const img = ctx.getImageData(0, 0, out.width, out.height);
    ctx.putImageData(opts.twoColor ? thresholdRedBlack(img) : threshold(img), 0, 0);
    return out;
  } finally {
    void canvas.dispose();
  }
}
