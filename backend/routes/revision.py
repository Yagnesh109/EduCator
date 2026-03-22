import time
import hashlib
from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from utils.mcq_utils import is_correct_option, resolve_correct_index, resolve_selected_index
from services.gemini_service import generate_items_from_source

router = APIRouter()

REVISION_FLASHCARD_LIMIT = 12
REVISION_QUIZ_COUNT = 6


def _topic(item):
    return str(item.get("topic", "General") if isinstance(item, dict) else "General").strip() or "General"


def _card_id(item):
    if not isinstance(item, dict):
        return str(item)
    if item.get("cardId"):
        return str(item.get("cardId"))
    if item.get("id"):
        return str(item.get("id"))
    base = f"{item.get('front','')}-{item.get('back','')}"
    return hashlib.sha1(base.encode("utf-8", "ignore")).hexdigest()


def _compute_topic_accuracy(mcqs, attempts):
    stats = {}
    for idx, item in enumerate(mcqs or []):
        topic = _topic(item)
        correct_answer = str(item.get("answer", "")).strip()
        selected = str(attempts.get(str(idx), attempts.get(idx, "")) or "").strip()
        if not selected:
            continue
        options = item.get("options", []) if isinstance(item, dict) else []
        options = options if isinstance(options, list) else []
        correct_idx = resolve_correct_index(options, correct_answer)
        selected_idx = resolve_selected_index(options, selected)
        if correct_idx != -1 and selected_idx != -1:
            correct = correct_idx == selected_idx
        else:
            correct = is_correct_option(selected, correct_answer)
        entry = stats.setdefault(topic, {"correct": 0, "total": 0, "incorrect_samples": []})
        entry["total"] += 1
        entry["correct"] += 1 if correct else 0
        if not correct:
            entry["incorrect_samples"].append(item)
    return stats


def _classify_topic(stat):
    if stat["total"] == 0:
        return "unknown"
    acc = stat["correct"] / stat["total"]
    if acc < 0.7:
        return "weak"
    if acc <= 0.85:
        return "medium"
    return "strong"


def _due_flashcards(flashcards, spaced_schedule):
    now = int(time.time())
    due_ids = set()
    for entry in spaced_schedule or []:
        try:
            if int(entry.get("dueAtEpoch", 0)) <= now:
                due_ids.add(entry.get("cardId"))
        except Exception:
            continue
    prioritized = []
    for fc in flashcards or []:
        cid = _card_id(fc)
        if cid in due_ids:
            prioritized.append(fc)
    return prioritized, due_ids


@router.post("/api/revision/start")
def start_revision(payload: dict = Body(default=None)):
    """
    Input payload (flexible):
      mcqs: list of mcq dicts
      attempts: map[index] -> selected answer
      flashcards: list of flashcard dicts ({front, back, topic})
      spacedSchedule: list of spaced repetition entries ({cardId, dueAtEpoch, box})
      limitFlashcards: optional int
      limitQuiz: optional int
    """
    try:
        payload = payload or {}
        mcqs = payload.get("mcqs") or []
        attempts = payload.get("attempts") or {}
        flashcards = payload.get("flashcards") or []
        spaced_schedule = payload.get("spacedSchedule") or []
        limit_flash = int(payload.get("limitFlashcards") or REVISION_FLASHCARD_LIMIT)
        limit_quiz = int(payload.get("limitQuiz") or REVISION_QUIZ_COUNT)

        stats = _compute_topic_accuracy(mcqs, attempts)
        weak_topics = []
        medium_topics = []
        strong_topics = []
        for name, stat in stats.items():
            label = _classify_topic(stat)
            entry = {
                "topic": name,
                "accuracy": stat["correct"] / stat["total"] if stat["total"] else 0,
                "attempted": stat["total"],
            }
            if label == "weak":
                weak_topics.append(entry)
            elif label == "medium":
                medium_topics.append(entry)
            else:
                strong_topics.append(entry)

        due_flash, due_ids = _due_flashcards(flashcards, spaced_schedule)

        weak_topic_set = {t["topic"] for t in weak_topics}
        def topic_key(fc):
            return 0 if _topic(fc) in weak_topic_set else 1

        prioritized = sorted(
            flashcards,
            key=lambda fc: (
                topic_key(fc),
                0 if _card_id(fc) in due_ids else 1,
            ),
        )
        revision_flashcards = prioritized[:limit_flash]
        if not revision_flashcards and flashcards:
            # fallback: take top N flashcards if no due/weak detected
            revision_flashcards = flashcards[:limit_flash]

        # Build a weak-source text from incorrect questions
        incorrect_items = []
        for name, stat in stats.items():
            incorrect_items.extend(stat.get("incorrect_samples", []))
        incorrect_text = "\n\n".join(
            [f"Q: {item.get('question','')}\nA: {item.get('answer','')}\nWhy: {item.get('explanation','')}" for item in incorrect_items]
        )
        topics_text = ", ".join([t["topic"] for t in weak_topics[:5]])
        instruction = (
            "Create a short quiz of "
            f"{limit_quiz} questions focused on the learner's weak topics and past mistakes.\n"
            "Return items as JSON objects with fields: question, options (4), answer, explanation, topic.\n"
            f"Weak topics: {topics_text or 'General'}.\n"
            "Emphasize misconceptions shown in the mistakes."
        )
        quiz_items = []
        if incorrect_text or topics_text:
            try:
                quiz_items = generate_items_from_source(incorrect_text or topics_text, instruction, expected_count=limit_quiz)
            except Exception:
                quiz_items = []

        response = {
            "flashcards": revision_flashcards,
            "quiz": quiz_items[:limit_quiz],
            "weakTopics": weak_topics,
            "mediumTopics": medium_topics,
            "strongTopics": strong_topics,
        }
        return response
    except Exception as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=400)
