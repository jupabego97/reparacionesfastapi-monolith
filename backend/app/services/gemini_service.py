import base64
import io
import json
import re
import tempfile

from loguru import logger
from PIL import Image, ImageOps
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.core.text_utils import strip_accents

PROMPT_EXTRACT_INFO = """
Eres un asistente experto en analizar imágenes de dispositivos electrónicos en un taller de reparación.

Analiza cuidadosamente esta imagen y extrae la siguiente información:

1. **NOMBRE DEL CLIENTE**:
   - Busca nombres escritos en etiquetas adhesivas
   - Busca nombres en papeles o notas pegadas al dispositivo
   - Si no encuentras ningún nombre, usa "Cliente"
   - El campo `nombre` debe escribirse SIN TILDES NI DIACRÍTICOS, conservando ñ como n y acentos eliminados
     (ejemplo: "Andrés Muñoz" → "Andres Munoz").

2. **NÚMERO DE TELÉFONO/WHATSAPP**:
   - Busca números de teléfono escritos
   - Si no encuentras ningún número, devuelve cadena vacía ""

3. **CARGADOR INCLUIDO**:
   - ¿Ves un cable USB, cable de carga o adaptador en la imagen?
   - Si NO ves ningún cable/cargador claramente, responde false

IMPORTANTE: Debes responder ÚNICAMENTE con un objeto JSON válido.

Formato: {"nombre": "...", "telefono": "...", "tiene_cargador": true/false}
"""


def get_gemini_service():
    settings = get_settings()
    api_key = (settings.gemini_api_key or "").strip()
    if not api_key or api_key == "your_gemini_api_key_here":
        return None
    try:
        return GeminiService()
    except Exception as e:
        logger.warning(f"Gemini no disponible: {e}")
        return None


class GeminiService:
    def __init__(self):
        settings = get_settings()
        api_key = (settings.gemini_api_key or "").strip()
        if not api_key or api_key == "your_gemini_api_key_here":
            raise ValueError("GEMINI_API_KEY no configurada")
        import google.generativeai as genai

        self._settings = settings
        self._genai = genai
        self._genai.configure(api_key=api_key)
        self.model = self._genai.GenerativeModel(
            settings.gemini_model,
            generation_config={
                "temperature": settings.gemini_temperature,
                "response_mime_type": "application/json",
            },
        )

    def _prepare_image(self, image_data: bytes | str) -> Image.Image:
        if isinstance(image_data, str) and image_data.startswith("data:image"):
            _, encoded = image_data.split(",", 1)
            image_data = base64.b64decode(encoded)
        if not isinstance(image_data, bytes):
            raise TypeError("image_data debe ser bytes o data URL")
        image = Image.open(io.BytesIO(image_data))
        image = ImageOps.exif_transpose(image)
        image = image.convert("RGB")
        image = ImageOps.autocontrast(image, cutoff=1)
        max_edge = 1600
        if max(image.size) > max_edge:
            image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
        return image

    def _normalize_nombre(self, nombre: str) -> str:
        base = (nombre or "").strip() or "Cliente"
        # ñ explícita según prompt; NFKD puede dejar n + combiner → strip_accents ya limpia
        no_tilde = strip_accents(base)
        return no_tilde.replace("ñ", "n").replace("Ñ", "N")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
    def extract_client_info_from_image(self, image_data, image_format="jpeg"):
        try:
            image = self._prepare_image(image_data)

            response = self.model.generate_content([PROMPT_EXTRACT_INFO, image])
            if not response.text:
                return {"nombre": "Cliente", "telefono": "", "tiene_cargador": False}

            cleaned = response.text.strip()
            if cleaned.startswith("```"):
                m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
                if m:
                    cleaned = m.group(1)
            try:
                result = json.loads(cleaned)
                result.setdefault("nombre", "Cliente")
                result.setdefault("telefono", "")
                result.setdefault("tiene_cargador", False)
                result["nombre"] = self._normalize_nombre(str(result.get("nombre", "Cliente")))
                result["telefono"] = str(result.get("telefono", "")).strip()
                result["tiene_cargador"] = bool(result.get("tiene_cargador", False))
                return result
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"Parseo JSON fallido: {e}")
                nombre_m = re.search(r'"nombre":\s*"([^"]+)"', response.text, re.I)
                telefono_m = re.search(r'"telefono":\s*"([^"]*)"', response.text, re.I)
                cargador_m = re.search(r'"tiene_cargador":\s*(true|false)', response.text, re.I)
                nombre_raw = (nombre_m.group(1).strip() if nombre_m else "Cliente") or "Cliente"
                return {
                    "nombre": self._normalize_nombre(nombre_raw),
                    "telefono": telefono_m.group(1).strip() if telefono_m else "",
                    "tiene_cargador": cargador_m and cargador_m.group(1).lower() == "true",
                }
        except Exception as e:
            logger.exception(f"Error procesando imagen: {e}")
            return {"nombre": "Cliente", "telefono": "", "tiene_cargador": False, "_error": str(e)}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
    def transcribe_audio(self, audio_data: bytes) -> str:
        import os

        path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio_data)
                path = f.name
            uploaded = self._genai.upload_file(path, mime_type="audio/wav")
            response = self.model.generate_content(["Transcribe exactamente lo que dice la persona. Solo el texto.", uploaded])
            try:
                self._genai.delete_file(uploaded.name)
            except Exception:
                pass
            return response.text.strip() if response.text else "No se pudo transcribir"
        except Exception as e:
            logger.exception(f"Error transcribiendo: {e}")
            return f"Error al transcribir: {e}"
        finally:
            if path and os.path.exists(path):
                try:
                    os.unlink(path)
                except Exception:
                    pass
