import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Tag, UserInfo, TarjetaCreate } from '../api/client';
import { useIsMobile } from '../hooks/useIsMobile';
import { captureVideoFrameToJpegBlob, imageFileToJpegBlob, blobToDataUrl } from '../utils/imageCapture';
import { newTarjetaCreatedWhatsAppUrl } from '../utils/whatsappUrl';

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

function defaultTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function NuevaTarjetaModal({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<'capture' | 'preview' | 'form'>('capture');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastCaptureBlobRef = useRef<Blob | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [iaSuggestionBanner, setIaSuggestionBanner] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const isMobile = useIsMobile();
  const [cameraActive, setCameraActive] = useState(() => window.innerWidth <= 768);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'partial_failed' | 'done'>('idle');

  const [form, setForm] = useState({
    nombre_propietario: '',
    problema: '',
    whatsapp: '',
    fecha_limite: defaultTomorrowDate(),
    tiene_cargador: 'si',
    imagen_url: '',
    prioridad: 'media',
    asignado_a: '' as string | number,
    costo_estimado: '' as string | number,
    notas_tecnicas: '',
  });
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { data: allTags = [] } = useQuery({ queryKey: ['tags'], queryFn: api.getTags });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: api.getUsers });

  const createMut = useMutation({
    mutationFn: (data: TarjetaCreate) => api.createTarjeta(data),
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Error al crear'),
  });

  useEffect(() => {
    const currentVideo = videoRef.current;
    return () => {
      if (currentVideo?.srcObject) {
        (currentVideo.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch {
      setError('No se pudo acceder a la cámara');
      setCameraActive(false);
    }
  };

  // En móvil: ir directo a la cámara al abrir, sin menú de opciones
  useEffect(() => {
    if (isMobile && step === 'capture') {
      setCameraActive(true);
      startCamera();
    }
  }, [isMobile, step]);

  const stopCameraTracks = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      setCameraActive(false);
    }
  }, []);

  const runImageAnalysis = useCallback((blob: Blob) => {
    setError('');
    setIaSuggestionBanner(false);
    setStep('form');
    setCapturedPreview(null);
    setAiAnalyzing(true);
    stopCameraTracks();

    void blobToDataUrl(blob).then(url => {
      setForm(prev => ({ ...prev, imagen_url: prev.imagen_url.trim() ? prev.imagen_url : url }));
    });

    void api
      .procesarImagenFile(blob)
      .then(result => {
        setForm(prev => ({
          ...prev,
          nombre_propietario: prev.nombre_propietario.trim()
            ? prev.nombre_propietario
            : (result.nombre || prev.nombre_propietario),
          whatsapp: prev.whatsapp.trim() ? prev.whatsapp : (result.telefono || prev.whatsapp),
          tiene_cargador: result.tiene_cargador ? 'si' : 'no',
        }));
        if (result._partial) {
          setError('IA no disponible. Complete los datos manualmente.');
        } else {
          setIaSuggestionBanner(true);
        }
      })
      .catch(() => {
        setError('No se pudo analizar la imagen. Complete los datos manualmente.');
        void blobToDataUrl(blob).then(url => {
          setForm(prev => ({ ...prev, imagen_url: prev.imagen_url.trim() ? prev.imagen_url : url }));
        });
      })
      .finally(() => setAiAnalyzing(false));
  }, [stopCameraTracks]);

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    setCapturing(true);
    try {
      const blob = await captureVideoFrameToJpegBlob(videoRef.current);
      lastCaptureBlobRef.current = blob;
      const dataUrl = await blobToDataUrl(blob);
      setFlash(true);
      setTimeout(() => setFlash(false), 200);
      setCapturedPreview(dataUrl);
      setStep('preview');
      stopCameraTracks();
    } catch {
      setError('No se pudo capturar la imagen. Intente de nuevo.');
    } finally {
      setCapturing(false);
    }
  };

  const confirmPhoto = () => {
    const blob = lastCaptureBlobRef.current;
    if (blob) runImageAnalysis(blob);
  };

  const retakePhoto = () => {
    lastCaptureBlobRef.current = null;
    setCapturedPreview(null);
    setCameraActive(true);
    setStep('capture');
    void startCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const all = [...photoFiles, ...files].slice(0, 10);
    if (all.length < photoFiles.length + files.length) {
      setError('Límite máximo de 10 fotos por tarjeta');
    }
    setPhotoFiles(all);
    const readers = all.map(file => new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = ev => resolve((ev.target?.result as string) || '');
      r.readAsDataURL(file);
    }));
    void Promise.all(readers).then(previews => {
      setPhotoPreviews(previews.filter(Boolean));
      const first = files[0];
      if (first) {
        void imageFileToJpegBlob(first)
          .then(blob => runImageAnalysis(blob))
          .catch(() => {
            setError('No se pudo leer la imagen.');
            setStep('form');
          });
      } else {
        setStep('form');
      }
    });
  };

  // Mejora #27: Validación con mensajes claros
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.nombre_propietario.trim()) errs.nombre = 'El nombre es requerido';
    if (form.whatsapp.trim()) {
      const digits = form.whatsapp.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) {
        errs.whatsapp = 'Ingrese un número válido (10–15 dígitos, ej. 300 123 4567 o +57 300 123 4567)';
      }
    }
    if (!form.fecha_limite) errs.fecha = 'La fecha límite es requerida';
    setValidationErrors(errs);
    if (Object.keys(errs).length > 0) {
      setTimeout(() => {
        document.querySelector('.field-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      const created = await createMut.mutateAsync({
      nombre_propietario: form.nombre_propietario.trim(),
      problema: form.problema.trim() || 'Sin descripción',
      whatsapp: form.whatsapp.trim(),
      fecha_limite: form.fecha_limite,
      tiene_cargador: form.tiene_cargador,
      imagen_url: photoFiles.length > 0 ? undefined : (form.imagen_url || undefined),
      prioridad: form.prioridad,
      asignado_a: form.asignado_a ? Number(form.asignado_a) : undefined,
      costo_estimado: form.costo_estimado ? Number(form.costo_estimado) : undefined,
      notas_tecnicas: form.notas_tecnicas || undefined,
      tags: selectedTags.length ? selectedTags : undefined,
    });
      if (photoFiles.length > 0) {
        setUploadState('uploading');
        try {
          await api.uploadTarjetaMedia(created.id, photoFiles);
          setUploadState('done');
        } catch {
          setUploadState('partial_failed');
          setError('Tarjeta creada, pero algunas fotos no se pudieron subir');
        }
      }

      onSuccess?.();

      const waUrl = newTarjetaCreatedWhatsAppUrl(
        created.whatsapp ?? form.whatsapp.trim(),
        created.nombre_propietario ?? form.nombre_propietario.trim(),
        created.id,
        created.problema ?? (form.problema.trim() || 'Sin descripción'),
      );
      if (waUrl) {
        // Navegación normal (sin popup) para evitar permisos del navegador.
        window.location.href = waUrl;
        return;
      } else if (form.whatsapp.trim()) {
        setError(
          'Tarjeta creada. El número de WhatsApp no es válido para abrir el chat (incluya código de país o 10 dígitos móvil CO).',
        );
        return;
      }

      onClose();
    } catch {
      setUploadState('idle');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-pro" onClick={e => e.stopPropagation()}>
        <div className="modal-pro-header">
          <h3><i className="fas fa-plus-circle"></i> Nueva reparación</h3>
          <button className="modal-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>

        <div className="modal-pro-body">
          {error && <div className="login-error"><i className="fas fa-exclamation-triangle"></i> {error}</div>}
          {step === 'capture' && (
            <div className={`capture-step ${isMobile && cameraActive ? 'camera-fullscreen' : ''}`}>
              {!cameraActive && (
                <p className="capture-instructions">
                  <i className="fas fa-magic"></i> Toma una foto del equipo y la IA extraerá los datos automáticamente
                </p>
              )}
              {cameraActive ? (
                <div className={`camera-container ${isMobile ? 'camera-fullscreen-inner' : ''}`}>
                  {isMobile && (
                    <button type="button" className="camera-back-btn" onClick={() => { (videoRef.current?.srcObject as MediaStream)?.getTracks().forEach(t => t.stop()); onClose(); }} aria-label="Cerrar cámara">
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                  {flash && <div className="capture-flash" aria-hidden="true" />}
                  <video ref={videoRef} autoPlay playsInline muted className="camera-preview" />
                  <button className="btn-capture btn-capture-large" onClick={() => void capturePhoto()} disabled={capturing}
                    type="button" aria-label="Tomar foto">
                    {capturing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-camera"></i>}
                  </button>
                </div>
              ) : (
                <div className="capture-options capture-options-horizontal">
                  <button className="capture-btn capture-btn-large" onClick={startCamera} type="button">
                    <i className="fas fa-camera"></i>
                    <span>Usar cámara</span>
                  </button>
                  <label className="capture-btn capture-btn-large">
                    <i className="fas fa-image"></i>
                    <span>Subir imágenes</span>
                    <input type="file" accept="image/*" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                  <button className="capture-btn capture-btn-large skip" onClick={() => setStep('form')} type="button">
                    <i className="fas fa-keyboard"></i>
                    <span>Sin imagen</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && capturedPreview && (
            <div className="capture-preview-step">
              <p className="capture-instructions">Revisa la foto</p>
              <div className="capture-preview-image">
                <img src={capturedPreview} alt="Vista previa" />
              </div>
              <div className="capture-preview-actions">
                <button className="btn-cancel" onClick={retakePhoto} type="button">
                  <i className="fas fa-redo"></i> Repetir
                </button>
                <button className="btn-save" onClick={confirmPhoto} type="button">
                  <><i className="fas fa-check"></i> Aceptar</>
                </button>
              </div>
            </div>
          )}

          {step === 'form' && (
            <div className="edit-form">
              {aiAnalyzing && (
                <div className="ia-analyzing-badge" role="status" aria-live="polite">
                  <i className="fas fa-brain fa-pulse" aria-hidden="true"></i> Analizando…
                </div>
              )}
              {iaSuggestionBanner && !aiAnalyzing && (
                <p className="ia-suggestion-hint"><i className="fas fa-magic" aria-hidden="true"></i> Datos sugeridos por IA (puede editarlos).</p>
              )}
              <div className="form-essentials">
                <div className="form-row">
                  <div className="form-group">
                    <label><i className="fas fa-user"></i> Propietario *</label>
                    <input value={form.nombre_propietario} onChange={e => setForm({ ...form, nombre_propietario: e.target.value })}
                      className={validationErrors.nombre ? 'error' : ''} autoFocus />
                    {validationErrors.nombre && <span className="field-error">{validationErrors.nombre}</span>}
                  </div>
                  <div className="form-group">
                    <label><i className="fab fa-whatsapp"></i> WhatsApp</label>
                    <input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })}
                      placeholder="+57 300 123 4567" className={validationErrors.whatsapp ? 'error' : ''} />
                    {validationErrors.whatsapp && <span className="field-error">{validationErrors.whatsapp}</span>}
                  </div>
                </div>
                <div className="form-group">
                  <label><i className="fas fa-exclamation-circle"></i> Problema</label>
                  <textarea rows={isMobile ? 2 : 3} value={form.problema} onChange={e => setForm({ ...form, problema: e.target.value })} placeholder="Describe el problema del equipo..." />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label><i className="fas fa-calendar"></i> Fecha límite *</label>
                    <input type="date" value={form.fecha_limite} onChange={e => setForm({ ...form, fecha_limite: e.target.value })}
                      className={validationErrors.fecha ? 'error' : ''} />
                    {validationErrors.fecha && <span className="field-error">{validationErrors.fecha}</span>}
                  </div>
                  <div className="form-group">
                    <label><i className="fas fa-plug"></i> Cargador</label>
                    <select value={form.tiene_cargador} onChange={e => setForm({ ...form, tiene_cargador: e.target.value })}>
                      <option value="si">Sí</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-advanced-accordion">
                <button type="button" className="form-advanced-toggle" onClick={() => setAdvancedOpen(!advancedOpen)}
                  aria-expanded={advancedOpen}>
                  <i className={`fas fa-chevron-${advancedOpen ? 'up' : 'down'}`}></i> Más opciones
                </button>
                {advancedOpen && (
                  <div className="form-advanced-content">
                    <div className="form-row">
                      <div className="form-group">
                        <label><i className="fas fa-flag"></i> Prioridad</label>
                        <select value={form.prioridad} onChange={e => setForm({ ...form, prioridad: e.target.value })}>
                          <option value="alta">Alta</option>
                          <option value="media">Media</option>
                          <option value="baja">Baja</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label><i className="fas fa-user-cog"></i> Asignar a</label>
                        <select value={form.asignado_a} onChange={e => setForm({ ...form, asignado_a: e.target.value })}>
                          <option value="">Sin asignar</option>
                          {users.map((u: UserInfo) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label><i className="fas fa-wrench"></i> Notas técnicas</label>
                      <textarea rows={2} value={form.notas_tecnicas} onChange={e => setForm({ ...form, notas_tecnicas: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label><i className="fas fa-dollar-sign"></i> Costo estimado</label>
                      <input type="number" value={form.costo_estimado} onChange={e => setForm({ ...form, costo_estimado: e.target.value })} placeholder="0" />
                    </div>
                    {allTags.length > 0 && (
                      <div className="form-group">
                        <label><i className="fas fa-tags"></i> Etiquetas</label>
                        <div className="tags-select">
                          {allTags.map((tag: Tag) => (
                            <button key={tag.id} type="button"
                              className={`tag-chip-btn ${selectedTags.includes(tag.id) ? 'selected' : ''}`}
                              style={{
                                borderColor: tag.color, color: selectedTags.includes(tag.id) ? '#fff' : tag.color,
                                background: selectedTags.includes(tag.id) ? tag.color : 'transparent'
                              }}
                              onClick={() => setSelectedTags(p => p.includes(tag.id) ? p.filter(i => i !== tag.id) : [...p, tag.id])}>
                              {tag.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {form.imagen_url && (
                <div className="preview-image">
                  <img src={form.imagen_url} alt="Preview" />
                  <button className="btn-del-sm" onClick={() => setForm({ ...form, imagen_url: '' })}><i className="fas fa-times"></i></button>
                </div>
              )}
              {photoPreviews.length > 0 && (
                <div className="photo-grid">
                  {photoPreviews.map((src, idx) => (
                    <div key={`${src}-${idx}`} className="preview-image">
                      <img src={src} alt={`Foto ${idx + 1}`} />
                    </div>
                  ))}
                  <small>{photoPreviews.length}/10 fotos</small>
                </div>
              )}
              {uploadState !== 'idle' && <small>Estado fotos: {uploadState}</small>}
            </div>
          )}
        </div>

        {step === 'form' && (
          <div className="modal-pro-footer">
            <button className="btn-cancel" onClick={() => setStep('capture')}>
              <i className="fas fa-arrow-left"></i> Volver
            </button>
            <button className="btn-save" onClick={handleSubmit} disabled={createMut.isPending}>
              {createMut.isPending ? <><i className="fas fa-spinner fa-spin"></i> Creando...</> : <><i className="fas fa-check"></i> Crear</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
