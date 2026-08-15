import { describe, expect, it } from 'vitest';
import { isWaitingServiceWorkerUpdate } from './registerServiceWorker';

describe('isWaitingServiceWorkerUpdate', () => {
  it('detecta un SW nuevo esperando mientras hay uno activo', () => {
    expect(isWaitingServiceWorkerUpdate('installed', true)).toBe(true);
  });

  it('no avisa en la primera instalación', () => {
    expect(isWaitingServiceWorkerUpdate('installed', false)).toBe(false);
  });

  it('ignora estados intermedios', () => {
    expect(isWaitingServiceWorkerUpdate('installing', true)).toBe(false);
  });
});
