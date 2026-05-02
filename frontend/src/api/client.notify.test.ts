import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './client';

function stubLocalStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage);
}

describe('api.notifyTarjetaCreated', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    stubLocalStorage();
  });

  it('POST /notify-created con token', async () => {
    localStorage.setItem('token', 't1');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'sent', message: 'Mensaje enviado', provider_message_id: 'wamid.x' }),
    } as Response);

    const r = await api.notifyTarjetaCreated(42);
    expect(r.status).toBe('sent');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/tarjetas\/42\/notify-created$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
