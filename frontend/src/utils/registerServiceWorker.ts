const NEW_VERSION_EVENT = 'app:new-version';

export function isWaitingServiceWorkerUpdate(
  state: string,
  hasController: boolean,
): boolean {
  return state === 'installed' && hasController;
}

function emitNewVersion() {
  window.dispatchEvent(new Event(NEW_VERSION_EVENT));
}

export function subscribeToNewVersion(onAvailable: () => void): () => void {
  const handler = () => onAvailable();
  window.addEventListener(NEW_VERSION_EVENT, handler);
  return () => window.removeEventListener(NEW_VERSION_EVENT, handler);
}

let waitingForUserReload = false;

export async function applyNewVersion(): Promise<void> {
  waitingForUserReload = true;
  const registration = await navigator.serviceWorker.getRegistration();
  const waiting = registration?.waiting;
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
    return;
  }
  window.location.reload();
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!waitingForUserReload) return;
    window.location.reload();
  });

  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'NEW_VERSION') {
      emitNewVersion();
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      const promptOrActivate = (worker: ServiceWorker | null) => {
        if (!worker) return;
        if (isWaitingServiceWorkerUpdate(worker.state, Boolean(navigator.serviceWorker.controller))) {
          emitNewVersion();
          return;
        }
        if (worker.state === 'installed' && !navigator.serviceWorker.controller) {
          worker.postMessage({ type: 'SKIP_WAITING' });
        }
      };

      promptOrActivate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => promptOrActivate(installing));
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void registration.update();
        }
      });
      void registration.update();
    }).catch(() => {
      /* silencioso */
    });
  });
}
