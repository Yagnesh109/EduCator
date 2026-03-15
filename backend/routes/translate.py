import json
from urllib.parse import quote
from urllib.request import urlopen

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

router = APIRouter()


def _translate(text: str, target_language: str) -> str:
    endpoint = (
        "https://translate.googleapis.com/translate_a/single"
        f"?client=gtx&sl=auto&tl={quote(target_language)}&dt=t&q={quote(text)}"
    )
    with urlopen(endpoint, timeout=20) as response:
        translated_raw = response.read().decode("utf-8", errors="ignore")
    translated_json = json.loads(translated_raw)
    segments = translated_json[0] if isinstance(translated_json, list) and translated_json else []
    translated_text = "".join([str(seg[0]) for seg in segments if isinstance(seg, list) and seg and seg[0]])
    return translated_text.strip() or text


@router.post("/api/translate")
def translate_text(payload: dict = Body(default=None)):
    try:
        payload = payload or {}
        text = str(payload.get("text", "")).strip()
        target_language = str(payload.get("targetLanguage", "en")).strip().lower() or "en"

        if not text:
            return JSONResponse(content={"error": "text is required"}, status_code=400)
        if target_language == "en":
            return {"text": text, "targetLanguage": target_language}

        try:
            translated = _translate(text, target_language)
        except Exception:
            translated = text

        return {"text": translated, "targetLanguage": target_language}
    except Exception as exc:
        return JSONResponse(content={"error": f"Unexpected server error: {exc}"}, status_code=500)

