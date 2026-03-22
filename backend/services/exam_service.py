import json
import os
import re
import time
from urllib import error as urlerror
from urllib import request as urlrequest

from services.gemini_service import extract_gemini_text
from utils.mcq_utils import (
    _aggressive_quote_repair,
    _repair_json_text,
    extract_json_object,
)

GEMINI_EXAM_API_KEY = os.getenv("GEMINI_EXAM_API_KEY", "")
GEMINI_EXAM_MODEL = os.getenv("GEMINI_EXAM_MODEL", "gemini-2.5-flash")
GEMINI_EXAM_MAX_TOKENS = int(os.getenv("GEMINI_EXAM_MAX_TOKENS", "3000"))
GEMINI_EXAM_TIMEOUT_SECONDS = int(os.getenv("GEMINI_EXAM_TIMEOUT_SECONDS", "90"))
GEMINI_EXAM_MAX_RETRIES = int(os.getenv("GEMINI_EXAM_MAX_RETRIES", "1"))


def _call_gemini_exam(prompt, max_output_tokens=GEMINI_EXAM_MAX_TOKENS):
    """
    Separate Gemini invocation that uses GEMINI_EXAM_API_KEY (do not reuse general key).
    """
    if not GEMINI_EXAM_API_KEY:
        raise RuntimeError("GEMINI_EXAM_API_KEY is missing in backend environment")

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_EXAM_MODEL}:generateContent"
        f"?key={GEMINI_EXAM_API_KEY}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": max_output_tokens,
            "responseMimeType": "application/json",
        },
    }
    payload_bytes = json.dumps(payload).encode("utf-8")

    last_error = None
    for attempt in range(GEMINI_EXAM_MAX_RETRIES + 1):
        req = urlrequest.Request(
            endpoint,
            data=payload_bytes,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlrequest.urlopen(req, timeout=GEMINI_EXAM_TIMEOUT_SECONDS) as response:
                return response.read().decode("utf-8")
        except urlerror.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="ignore")
            last_error = f"Gemini Exam HTTP {exc.code}: {error_body}"
            # Retry lightly on 429/503
            if exc.code in {429, 503} and attempt < GEMINI_EXAM_MAX_RETRIES:
                time.sleep(1.5 + attempt)
                continue
            raise RuntimeError(last_error) from exc
        except Exception as exc:  # pragma: no cover
            last_error = str(exc)
            if attempt < GEMINI_EXAM_MAX_RETRIES:
                time.sleep(1.0 + attempt)
                continue
            raise RuntimeError(last_error) from exc

    raise RuntimeError(last_error or "Gemini exam request failed")


def _sanitize_sections(sections):
    safe = []
    for item in sections or []:
        try:
            name = str(item.get("name", "")).strip() or "General"
            count = int(item.get("questions", 0) or 0)
            weight = float(item.get("weight", 0) or 0)
            safe.append({"name": name[:60], "questions": max(1, count), "weight": max(0.0, weight)})
        except Exception:
            continue
    if not safe:
        safe = [
            {"name": "Concepts", "questions": 7, "weight": 0.35},
            {"name": "Applications", "questions": 7, "weight": 0.35},
            {"name": "Challenge", "questions": 6, "weight": 0.3},
        ]
    return safe


def generate_mock_exam(syllabus_text, past_papers_text="", sections=None, total_questions=20, duration_minutes=60):
    sections = _sanitize_sections(sections)
    total_questions = max(5, min(int(total_questions or 20), 80))
    duration_minutes = max(20, min(int(duration_minutes or 60), 240))

    section_lines = "\n".join(
        [f"- {s['name']} ({s['questions']} questions, weight {s['weight']:.2f})" for s in sections]
    )
    prompt = (
        "You are an exam setter. Build a timed mock exam focused strictly on the syllabus and past papers provided.\n"
        f"Total questions: {total_questions}. Total time (minutes): {duration_minutes}.\n"
        "Respect the provided sections/weights; if counts do not sum to total, scale proportionally.\n"
        "Output a strict JSON object with keys: sections, questions, timing.\n"
        "sections: list of {name, plannedQuestions, weight, focusTopics[]}.\n"
        "questions: list of objects with fields "
        "{id, section, question, options[4], answer, explanation, difficulty (easy|medium|hard), suggestedTimeMinutes}.\n"
        "timing: {totalMinutes, recommendedPacingPerSection: map section->minutes}.\n"
        "Use only syllabus/past paper topics; avoid generic filler.\n"
        "Return JSON only, no markdown, no comments.\n"
        f"Syllabus:\n{syllabus_text}\n\nPast papers (optional):\n{past_papers_text}\n\n"
        "Sections requested:\n"
        f"{section_lines}\n"
    )

    body = _call_gemini_exam(prompt, max_output_tokens=max(GEMINI_EXAM_MAX_TOKENS, 8192))
    data = json.loads(body)
    text = extract_gemini_text(data)
    if not text:
        raise RuntimeError("Gemini returned empty mock exam response")
    text = text.strip()

    def _coerce_json_object(raw: str):
        """
        Gemini sometimes returns:
        - Markdown fences
        - JSON wrapped in a quoted string
        - Slightly malformed JSON (smart quotes, stray commas, etc.)
        Try progressively stronger repairs before giving up.
        """
        # Strip common fences/backticks
        cleaned = re.sub(r"^```json|```$", "", raw, flags=re.MULTILINE).strip()

        # Remove common invisible/bom chars that break json at early positions
        cleaned = cleaned.lstrip("\ufeff\u200b\u200c\u200d")
        # Drop other ASCII control chars (except whitespace that JSON allows between tokens)
        cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", cleaned)

        # Unwrap if the whole payload is a quoted JSON string
        if cleaned.startswith('"') and cleaned.endswith('"'):
            try:
                decoded = json.loads(cleaned)
                if isinstance(decoded, str):
                    cleaned = decoded.strip()
            except Exception:
                pass

        # If stray text before/after JSON, clip to first '{' ... last '}'
        if "{" in cleaned and "}" in cleaned:
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            cleaned = cleaned[start : end + 1]

        # 1) Normal path (strict)
        try:
            return extract_json_object(cleaned)
        except Exception:
            pass

        # 1b) Allow control chars inside strings
        try:
            parsed = json.loads(cleaned, strict=False)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

        # 2) Repair common JSON issues (smart quotes, trailing commas)
        try:
            repaired = _repair_json_text(cleaned)
            parsed = json.loads(repaired, strict=False)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

        # 3) Aggressive repair (drop backslashes before quotes)
        repaired_aggressive = _aggressive_quote_repair(cleaned)
        return json.loads(repaired_aggressive, strict=False)

    try:
        result = _coerce_json_object(text)
    except Exception as exc:  # pragma: no cover
        preview = text[:240].replace("\n", " ")
        raise RuntimeError(f"Failed to parse mock exam JSON: {exc}; preview: {preview}") from exc

    if not isinstance(result, dict):
        raise RuntimeError("Mock exam JSON is not an object")

    # Light validation
    questions = result.get("questions", []) if isinstance(result, dict) else []
    if not questions:
        raise RuntimeError("Mock exam JSON missing questions")
    return result
