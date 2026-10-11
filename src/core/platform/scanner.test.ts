import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Simulierte Kamera: zählt Anfragen, Spuren lassen sich stoppen. */
function fakeMedia() {
  const streams: { stopped: boolean }[] = [];
  let resolveNext: (() => void) | null = null;
  const getUserMedia = vi.fn(
    () =>
      new Promise<MediaStream>((resolve) => {
        const track = { readyState: 'live' as 'live' | 'ended', stop() { track.readyState = 'ended'; rec.stopped = true; } };
        const rec = { stopped: false };
        streams.push(rec);
        resolveNext = () => resolve({ getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream);
      }),
  );
  return { streams, getUserMedia, grant: () => resolveNext?.() };
}

describe('Kamera teilen (iOS fragt sonst jedes Mal)', () => {
  let media: ReturnType<typeof fakeMedia>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    media = fakeMedia();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: media.getUserMedia } });
    vi.stubGlobal('document', { hidden: false, addEventListener: () => undefined });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('gleichzeitige Starts teilen sich eine Kamera-Abfrage', async () => {
    const { _camera } = await import('./scanner');
    const a = _camera.acquire();
    const b = _camera.acquire();
    media.grant();
    expect(await a).toBe(await b);
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('Abbruch während der Abfrage + Neustart: der Timer stoppt nicht den laufenden Strom', async () => {
    const { _camera } = await import('./scanner');
    const first = _camera.acquire();
    media.grant();
    const s1 = await first;
    _camera.release(s1); // erster Scanner abgebrochen → 60-s-Timer
    const s2 = await _camera.acquire(); // zweiter übernimmt denselben warmen Strom
    expect(s2).toBe(s1);
    vi.advanceTimersByTime(_camera.LINGER_MS + 1000);
    expect(media.streams[0]!.stopped).toBe(false); // noch in Benutzung
    _camera.release(s2);
    vi.advanceTimersByTime(_camera.LINGER_MS + 1000);
    expect(media.streams[0]!.stopped).toBe(true); // jetzt frei → nach 60 s aus
    expect(media.getUserMedia).toHaveBeenCalledTimes(1);
  });
});
