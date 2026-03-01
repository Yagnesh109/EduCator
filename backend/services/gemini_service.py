import json
import os
import re
import time
from urllib import error as urlerror
from urllib import request as urlrequest

from utils.mcq_utils import extract_json_array


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
GEMINI_MAX_RETRIES = int(os.getenv("GEMINI_MAX_RETRIES", "2"))
GEMINI_MAX_TOKENS = int(os.getenv("GEMINI_MAX_TOKENS", "1200"))


def extract_gemini_text(data):
    candidates = data.get("candidates", [])
    if not candidates:
        return ""
    content = candidates[0].get("content", {})
    parts = content.get("parts", [])
    chunks = []
    for part in parts:
        text = part.get("text")
        if text:
            chunks.append(text)
    return "\n".join(chunks).strip()


def call_gemini(prompt):
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is missing in backend environment")

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
        f"?key={GEMINI_API_KEY}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": GEMINI_MAX_TOKENS,
            "responseMimeType": "application/json",
        },
    }
    payload_bytes = json.dumps(payload).encode("utf-8")

    last_error = None
    for attempt in range(GEMINI_MAX_RETRIES + 1):
        req = urlrequest.Request(
            endpoint,
            data=payload_bytes,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlrequest.urlopen(req, timeout=120) as response:
                return response.read().decode("utf-8")
        except urlerror.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="ignore")
            last_error = f"Gemini HTTP {exc.code}: {error_body}"

            if exc.code == 429 and attempt < GEMINI_MAX_RETRIES:
                retry_after = 1.5
                retry_match = re.search(r"retry in ([0-9.]+)s", error_body, flags=re.IGNORECASE)
                if retry_match:
                    retry_after = float(retry_match.group(1))
                time.sleep(max(1.0, retry_after))
                continue

            raise RuntimeError(last_error) from exc

    raise RuntimeError(last_error or "Gemini request failed")


def generate_items_from_source(source_text, instruction, expected_count=10):
    prompt = (
        f"{instruction}\n\n"
        "Return only JSON array with no markdown fences and no extra text.\n\n"
        f"Source content:\n{source_text}"
    )

    body = call_gemini(prompt)
    data = json.loads(body)
    text = extract_gemini_text(data)
    if not text:
        raise RuntimeError("Model returned empty response")

    items = extract_json_array(text)
    if not isinstance(items, list):
        raise RuntimeError("Model response is not a list")
    if len(items) < expected_count:
        raise RuntimeError(f"Model returned {len(items)} items, expected {expected_count}")

    return items[:expected_count]


def generate_summary_from_source(source_text):
    prompt = (
        "Create a concise study summary from the provided content. "
        "Return 5-7 bullet points as plain text. "
        "Do not include markdown fences or extra commentary.\n\n"
        f"Source content:\n{source_text}"
    )
    body = call_gemini(prompt)
    data = json.loads(body)
    text = extract_gemini_text(data).strip()
    if not text:
        raise RuntimeError("Model returned empty summary")
    return text
