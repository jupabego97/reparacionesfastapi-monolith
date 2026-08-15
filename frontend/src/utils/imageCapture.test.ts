import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAMERA_CONSTRAINT_ATTEMPTS, openUserCamera } from './imageCapture';

describe('openUserCamera', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reintenta con restricciones más simples si las primeras fallan', async () => {
    const stream = { id: 'ok' } as unknown as MediaStream;
    const getUserMedia = vi.fn()
      .mockRejectedValueOnce(new Error('OverconstrainedError'))
      .mockRejectedValueOnce(new Error('NotFoundError'))
      .mockResolvedValueOnce(stream);

    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });

    await expect(openUserCamera()).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledTimes(CAMERA_CONSTRAINT_ATTEMPTS.length);
  });

  it('falla con mensaje claro si no hay mediaDevices', async () => {
    vi.stubGlobal('navigator', {});
    await expect(openUserCamera()).rejects.toThrow(/HTTPS/);
  });
});
