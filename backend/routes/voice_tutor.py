import time
from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from services.gemini_service import generate_items_from_source, generate_summary_from_source

router = APIRouter()

VOICE_MAX_HISTORY = 8


def _format_history(history):
    lines = []
    for msg in history[-VOICE_MAX_HISTORY:]:
        role = msg.get("role", "user")
        text = str(msg.get("text", "")).strip()
        lines.append(f"{role.upper()}: {text}")
    return "\n".join(lines)


@router.post("/api/voice/chat")
def voice_chat(payload: dict = Body(default=None)):
    """
    Input: { message, sessionId?, history?: [{role:'user'|'assistant', text}] }
    Output: { reply, suggestions: [..] }
    """
    try:
        payload = payload or {}
        message = str(payload.get("message", "")).strip()
        history = payload.get("history") or []
        if not message:
            return JSONResponse(content={"error": "message is required"}, status_code=400)
        history_text = _format_history(history)
        prompt = (
            "You are a friendly voice tutor. Be concise and educational. "
            "Use simple language. After answering, suggest 1-2 next actions.\n\n"
            f"History:\n{history_text}\n\n"
            f"User: {message}\nAssistant:"
        )
        items = generate_items_from_source("", prompt, expected_count=1)
        reply = ""
        if items:
            reply = str(items[0]) if not isinstance(items[0], dict) else str(items[0].get("text", "") or items[0].get("reply", ""))
        if not reply:
            reply = generate_summary_from_source(message) or "Here's a quick answer."

        suggestion_prompt = (
            "Suggest 2 brief next learning actions based on the last answer. "
            "Return as a JSON array of short strings."
        )
        suggestions = []
        try:
            suggestions = generate_items_from_source(reply, suggestion_prompt, expected_count=2)
            suggestions = [s if isinstance(s, str) else str(getattr(s, "get", lambda x, y: "")("text", "")) for s in suggestions]
        except Exception:
            suggestions = []

        return {"reply": reply, "suggestions": suggestions[:2]}
    except Exception as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=400)


@router.post("/api/voice/quiz")
def voice_quiz(payload: dict = Body(default=None)):
    """
    Input: { question, answer }
    Output: { correct, feedback }
    """
    try:
        payload = payload or {}
        question = str(payload.get("question", "")).strip()
        answer = str(payload.get("answer", "")).strip()
        if not question or not answer:
            return JSONResponse(content={"error": "question and answer required"}, status_code=400)
        prompt = (
            "Evaluate the learner's answer semantically. Respond with JSON: "
            '{"correct": true|false, "feedback": "short explanation"}\n'
            f"Question: {question}\nLearner answer: {answer}\n"
        )
        result = generate_items_from_source("", prompt, expected_count=1)
        if result and isinstance(result[0], dict):
            return {"correct": bool(result[0].get("correct")), "feedback": result[0].get("feedback", "")}
        return {"correct": False, "feedback": "Could not evaluate."}
    except Exception as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=400)
