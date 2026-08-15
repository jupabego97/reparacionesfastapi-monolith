import { useEffect, useState } from 'react';
import { applyNewVersion, subscribeToNewVersion } from '../utils/registerServiceWorker';

export default function UpdateBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeToNewVersion(() => setVisible(true)), []);

  if (!visible) return null;

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span>Hay disponible una nueva versión</span>
      <button type="button" onClick={() => { void applyNewVersion(); }}>
        Actualizar
      </button>
    </div>
  );
}
