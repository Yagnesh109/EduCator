import json
import os

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from services.exam_service import generate_mock_exam
from routes.generate import get_source_text_from_request
from utils.extractors import extract_docx_text, extract_pdf_text, extract_pptx_text, extract_txt_text

router = APIRouter()

TEMP_UPLOAD_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "temp_uploads"))


def _resolve_temp_upload(file_id: str) -> str:
    if not file_id:
        return ""
    prefix = f"{file_id}__"
    try:
        for name in os.listdir(TEMP_UPLOAD_DIR):
            if name.startswith(prefix):
                return os.path.join(TEMP_UPLOAD_DIR, name)
    except FileNotFoundError:
        return ""
    return ""


def _extract_text_from_file_bytes(filename: str, data: bytes) -> str:
    lower_name = filename.lower()
    if lower_name.endswith(".pptx"):
        return extract_pptx_text(data)
    if lower_name.endswith(".docx"):
        return extract_docx_text(data)
    if lower_name.endswith(".pdf"):
        return extract_pdf_text(data)
    if lower_name.endswith(".txt"):
        return extract_txt_text(data)
    if lower_name.endswith(".doc") or lower_name.endswith(".ppt"):
        raise ValueError("Legacy .doc/.ppt files are not supported. Please upload .docx/.pptx.")
    raise ValueError("Unsupported file type. Upload txt, pdf, docx, or pptx.")


async def _extract_upload_text(upload) -> str:
    if not upload or not hasattr(upload, "filename"):
        return ""
    filename = str(upload.filename or "uploaded.file")
    data = await upload.read()
    if not data:
        return ""
    return _extract_text_from_file_bytes(filename, data)


@router.post("/api/exam/mock")
async def create_mock_exam(request: Request):
    """
    Accepts JSON or multipart form.
    - syllabus text OR syllabus file (file)
    - past papers text OR past papers file (pastFile)
    - totalQuestions, durationMinutes
    """
    try:
        syllabus = ""
        past_papers = ""
        sections = None
        total_questions = 20
        duration_minutes = 60

        def _to_int(value, default):
            try:
                return int(value)
            except Exception:
                return default

        content_type = request.headers.get("content-type", "").lower()
        if "application/json" in content_type:
            payload = await request.json()
            syllabus = str(payload.get("syllabus") or "").strip()
            past_papers = str(payload.get("pastPapers") or "").strip()
            sections = payload.get("sections") if isinstance(payload.get("sections"), list) else None
            total_questions = _to_int(payload.get("totalQuestions") or payload.get("questions") or 20, 20)
            duration_minutes = _to_int(payload.get("durationMinutes") or payload.get("duration") or 60, 60)
        else:
            form = await request.form()
            syllabus = str(form.get("syllabus") or "").strip()
            past_papers = str(form.get("pastPapers") or "").strip()
            sections_raw = form.get("sections")
            try:
                sections = json.loads(sections_raw) if sections_raw else None
            except Exception:
                sections = None
            total_questions = _to_int(form.get("totalQuestions") or form.get("questions") or 20, 20)
            duration_minutes = _to_int(form.get("durationMinutes") or form.get("duration") or 60, 60)

            # File uploads
            syllabus_upload = form.get("file")
            past_upload = form.get("pastFile")
            file_id = str(form.get("fileId") or "").strip()
            past_file_id = str(form.get("pastFileId") or "").strip()
            text_field = str(form.get("text") or "").strip()

            if not syllabus and syllabus_upload:
                try:
                    syllabus = await _extract_upload_text(syllabus_upload)
                except Exception:
                    syllabus = ""
            if not past_papers and past_upload:
                try:
                    past_papers = await _extract_upload_text(past_upload)
                except Exception:
                    past_papers = ""

            if not syllabus and file_id:
                path = _resolve_temp_upload(file_id)
                if path and os.path.exists(path):
                    with open(path, "rb") as handle:
                        syllabus = _extract_text_from_file_bytes(os.path.basename(path), handle.read())

            if not past_papers and past_file_id:
                path = _resolve_temp_upload(past_file_id)
                if path and os.path.exists(path):
                    with open(path, "rb") as handle:
                        past_papers = _extract_text_from_file_bytes(os.path.basename(path), handle.read())

            if not syllabus and text_field:
                syllabus = text_field

            # As a last resort, reuse the generic helper (supports fileId/file/text fields)
            if not syllabus:
                try:
                    source_text, _meta = await get_source_text_from_request(request)
                    syllabus = source_text
                except Exception:
                    syllabus = ""

        if not syllabus:
            return JSONResponse(content={"error": "syllabus is required"}, status_code=400)

        result = generate_mock_exam(
            syllabus_text=syllabus,
            past_papers_text=past_papers,
            sections=sections,
            total_questions=total_questions,
            duration_minutes=duration_minutes,
        )
        return {
            "mockExam": result,
            "meta": {
                "totalQuestions": total_questions,
                "durationMinutes": duration_minutes,
            },
        }
    except ValueError as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=400)
    except RuntimeError as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=502)
    except Exception as exc:
        return JSONResponse(content={"error": f"Unexpected server error: {exc}"}, status_code=500)
