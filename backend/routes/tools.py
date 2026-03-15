from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from routes.generate import get_source_text_from_request
from services.mcq_session import store_mcq_session, update_mcq_session
from services.gemini_service import (
    OPENROUTER_FLASHCARDS_API_KEY,
    OPENROUTER_FILL_IN_THE_BLANKS_KEY,
    OPENROUTER_TRUE_FALSE_KEY,
    OPENROUTER_API_KEY,
    generate_items_from_source,
    generate_mcqs_from_source_openrouter,
    generate_flashcards_from_source_openrouter,
    generate_fill_in_the_blanks_from_source_openrouter,
    generate_true_false_from_source_openrouter,
    generate_summary_from_source,
    generate_study_set_from_source,
)

router = APIRouter()


def _normalize_tool(value: str) -> str:
    raw = str(value or "").strip().lower()
    aliases = {
        "mcq": "mcq",
        "mcqs": "mcq",
        "flashcard": "flashcards",
        "flashcards": "flashcards",
        "fill_blanks": "fill_blanks",
        "fill-blanks": "fill_blanks",
        "fill_blanks_questions": "fill_blanks",
        "fill_in_the_blanks": "fill_blanks",
        "true_false": "true_false",
        "true-false": "true_false",
        "summary": "summary",
        "study_set": "study_set",
        "study-set": "study_set",
        "studyset": "study_set",
    }
    return aliases.get(raw, "")


def _normalize_count(value, default=10, max_count=50) -> int:
    try:
        count = int(value)
    except Exception:
        count = default
    if count < 1:
        count = default
    if count > max_count:
        count = max_count
    return count


@router.post("/api/tools/generate")
async def tool_generate(request: Request):
    try:
        form = await request.form()
        tool = _normalize_tool(form.get("tool"))
        if not tool:
            return JSONResponse(
                content={
                    "error": "tool is required (mcq, flashcards, fill_blanks, true_false, summary, study_set)"
                },
                status_code=400,
            )

        count = _normalize_count(form.get("count"), default=20, max_count=80)

        source_text, source_meta = await get_source_text_from_request(request)
        difficulty = str(source_meta.get("difficulty", "medium")).strip().lower() or "medium"

        if tool == "study_set":
            result = generate_study_set_from_source(source_text, expected_count=count, difficulty=difficulty)
            mcqs = result.get("mcqs", [])
            flashcards = result.get("flashcards", [])
            summary = result.get("summary", "")
            mcq_set_id = store_mcq_session(mcqs)
            update_mcq_session(mcq_set_id, items=mcqs, flashcards=flashcards, source_text=source_text)
            return {
                "tool": tool,
                "mcqs": mcqs,
                "flashcards": flashcards,
                "summary": summary,
                "mcqSetId": mcq_set_id,
                "meta": {
                    "difficulty": difficulty,
                    "count": count,
                    **source_meta,
                },
            }

        if tool == "mcq":
            if OPENROUTER_API_KEY:
                mcqs = generate_mcqs_from_source_openrouter(source_text, expected_count=count, difficulty=difficulty)
            else:
                instruction = (
                    "Difficulty: easy = basic recall/definitions; medium = conceptual and moderately challenging; "
                    "hard = advanced reasoning, nuanced distractors, and deeper understanding.\n"
                    f"Selected difficulty: {difficulty}.\n\n"
                    f"Create exactly {count} MCQs from the provided content. "
                    "Each item must be: "
                    "{\"question\":\"...\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"answer\":\"...\",\"explanation\":\"...\",\"topic\":\"...\"}. "
                    "The explanation should briefly explain why the correct answer is right."
                )
                mcqs = generate_items_from_source(source_text, instruction, expected_count=count)

            mcq_set_id = store_mcq_session(mcqs)
            update_mcq_session(mcq_set_id, items=mcqs, flashcards=[], source_text=source_text)
            return {
                "tool": tool,
                "mcqs": mcqs,
                "mcqSetId": mcq_set_id,
                "meta": {
                    "difficulty": difficulty,
                    "count": count,
                    **source_meta,
                },
            }

        if tool == "flashcards":
            if OPENROUTER_FLASHCARDS_API_KEY:
                flashcards = generate_flashcards_from_source_openrouter(source_text, expected_count=count, difficulty=difficulty)
            else:
                instruction = (
                    "Difficulty: easy = direct definitions; medium = conceptual Q/A; hard = nuanced, tricky, and application-focused.\n"
                    f"Selected difficulty: {difficulty}.\n\n"
                    f"Create exactly {count} flashcards from the provided content. "
                    "Each item must be: {\"front\":\"...\",\"back\":\"...\",\"topic\":\"...\"}."
                )
                flashcards = generate_items_from_source(source_text, instruction, expected_count=count)
            return {
                "tool": tool,
                "flashcards": flashcards,
                "meta": {
                    "difficulty": difficulty,
                    "count": count,
                    **source_meta,
                },
            }

        if tool == "fill_blanks":
            if not OPENROUTER_FILL_IN_THE_BLANKS_KEY:
                raise RuntimeError("OPENROUTER_FILL_IN_THE_BLANKS_KEY is missing in backend environment")
            items = generate_fill_in_the_blanks_from_source_openrouter(
                source_text, expected_count=count, difficulty=difficulty
            )
            return {
                "tool": tool,
                "fillBlanks": items,
                "meta": {
                    "difficulty": difficulty,
                    "count": count,
                    **source_meta,
                },
            }

        if tool == "true_false":
            if not OPENROUTER_TRUE_FALSE_KEY:
                raise RuntimeError("OPENROUTER_TRUE_FALSE_KEY is missing in backend environment")
            items = generate_true_false_from_source_openrouter(source_text, expected_count=count, difficulty=difficulty)
            return {
                "tool": tool,
                "trueFalse": items,
                "meta": {
                    "difficulty": difficulty,
                    "count": count,
                    **source_meta,
                },
            }

        if tool == "summary":
            summary = generate_summary_from_source(source_text)
            return {
                "tool": tool,
                "summary": summary,
                "meta": {
                    "difficulty": difficulty,
                    "count": count,
                    **source_meta,
                },
            }

        return JSONResponse(content={"error": f"Unsupported tool: {tool}"}, status_code=400)
    except ValueError as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=400)
    except RuntimeError as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=502)
    except Exception as exc:
        return JSONResponse(content={"error": f"Unexpected server error: {exc}"}, status_code=500)
