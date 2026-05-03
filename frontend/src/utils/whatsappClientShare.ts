import type { Tarjeta } from '../api/client';

/**
 * Abrir WhatsApp del teléfono (app tradicional). No usa Meta Cloud API.
 * wa.me solo admite texto; la foto va por navigator.share cuando el SO lo permite.
 */

/** Colombia: 10 dígitos que empiezan por 3 → prefijo país (igual que backend). */
export function normalizeWhatsappDigits(phone: string, defaultCountryCode = '57'): string | null {
  if (!phone?.trim()) return null;
  let digits = phone.replace(/\D/g, '');
  const cc = (defaultCountryCode || '57').replace(/\D/g, '') || '57';
  if (digits.length === 10 && digits.startsWith('3')) {
    digits = cc + digits;
  }
  if (digits.length < 10) return null;
  return digits;
}

export function buildTarjetaCreatedClientMessage(
  created: Pick<Tarjeta, 'id' | 'nombre_propietario' | 'problema' | 'fecha_limite'>,
  form: { nombre_propietario: string; problema: string; fecha_limite: string },
): string {
  const nombre = (created.nombre_propietario || form.nombre_propietario || 'Cliente').trim();
  let prob = (created.problema || form.problema || 'Sin descripción').trim();
  if (prob.length > 500) prob = `${prob.slice(0, 497)}...`;
  const rawDate = created.fecha_limite || form.fecha_limite || '';
  const dl = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
  const tid = created.id;
  return (
    `Hola ${nombre}, registramos tu equipo para reparación.\n` +
    `Folio: #${tid}\n` +
    `Motivo: ${prob}\n` +
    `Fecha límite estimada: ${dl}\n` +
    'Te avisaremos por este canal cuando haya novedades.'
  );
}

export async function dataUrlToShareableFile(dataUrl: string, filename = 'equipo.jpg'): Promise<File | null> {
  if (!dataUrl.startsWith('data:')) return null;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || 'image/jpeg' });
  } catch {
    return null;
  }
}

export type OpenWhatsAppResult =
  | { kind: 'shared' }
  | { kind: 'open_url'; url: string }
  | { kind: 'skipped_no_phone' };

/**
 * 1) Si hay imagen y el dispositivo permite compartir archivos: comparte foto + texto (el usuario elige WhatsApp y el chat).
 * 2) Si no: devuelve URL wa.me (el llamador debe abrirla tras onSuccess/onClose para no perder invalidación del tablero).
 */
export async function openWhatsAppWithTarjetaMessage(options: {
  phone: string;
  message: string;
  imageFile: File | null;
}): Promise<OpenWhatsAppResult> {
  const digits = normalizeWhatsappDigits(options.phone);
  if (!digits) return { kind: 'skipped_no_phone' };

  const { message, imageFile } = options;
  const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  if (imageFile && typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      if (navigator.canShare({ files: [imageFile] })) {
        await navigator.share({
          files: [imageFile],
          text: message,
          title: 'Reparación',
        });
        return { kind: 'shared' };
      }
    } catch {
      // Usuario canceló o falló el share: abrir chat con texto (sin foto en el enlace)
    }
  }

  return { kind: 'open_url', url: waUrl };
}
