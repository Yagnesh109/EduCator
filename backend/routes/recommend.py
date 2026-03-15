import os
from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from services.mcq_session import get_mcq_session
from utils.mcq_utils import is_correct_option, resolve_correct_index, resolve_selected_index

router = APIRouter()

RECOMMEND_MAX_WEAK_TOPICS = int(os.getenv("RECOMMEND_MAX_WEAK_TOPICS", "2"))
RECOMMEND_SOURCE_CHAR_LIMIT = int(os.getenv("RECOMMEND_SOURCE_CHAR_LIMIT", "1800"))

from services.gemini_service import generate_items_from_source, generate_summary_from_source


def _safe_topic(value):
    topic = str(value or "").strip()
    return topic or "General"


def _topic_context(items, answers, topic):
    chunks = []
    for index, item in enumerate(items):
        if _safe_topic(item.get("topic")) != topic:
            continue
        question = str(item.get("question", "")).strip()
        options = item.get("options", []) if isinstance(item, dict) else []
        options = options if isinstance(options, list) else []
        answer = str(answers[index]).strip() if index < len(answers) else str(item.get("answer", "")).strip()
        explanation = str(item.get("explanation", "")).strip()
        option_text = " | ".join([str(opt) for opt in options[:4]])
        chunks.append(
            f"Q: {question}\nOptions: {option_text}\nCorrect: {answer}\nWhy: {explanation}"
        )
    text = "\n\n".join(chunks)
    if len(text) > RECOMMEND_SOURCE_CHAR_LIMIT:
        return text[:RECOMMEND_SOURCE_CHAR_LIMIT]
    return text


def _compute_topic_stats(items, answers, selected_answers):
    by_topic = {}
    for index, item in enumerate(items):
        if index >= len(answers):
            continue
        topic = _safe_topic(item.get("topic"))
        correct_answer = answers[index]
        selected_answer = str(selected_answers.get(str(index), "") or selected_answers.get(index, "")).strip()
        if not selected_answer:
            continue

        options = item.get("options", []) if isinstance(item, dict) else []
        options = options if isinstance(options, list) else []
        correct_index = resolve_correct_index(options, correct_answer)
        selected_index = resolve_selected_index(options, selected_answer)
        if correct_index != -1 and selected_index != -1:
            correct = correct_index == selected_index
        else:
            correct = is_correct_option(selected_answer, correct_answer)

        entry = by_topic.setdefault(topic, {"correct": 0, "total": 0, "question_indices": []})
        entry["total"] += 1
        entry["correct"] += 1 if correct else 0
        entry["question_indices"].append(index)
    return by_topic


def _build_local_revision_summary(topic, flashcards, mcqs):
    points = []
    if isinstance(flashcards, list):
        for item in flashcards[:3]:
            back = str(item.get("back", "")).strip()
            if back:
                points.append(back)
    if isinstance(mcqs, list):
        for item in mcqs[:2]:
            explanation = str(item.get("explanation", "")).strip()
            if explanation:
                points.append(explanation)
    unique_points = []
    seen = set()
    for point in points:
        key = point.lower()
        if key in seen:
            continue
        seen.add(key)
        unique_points.append(point)
    if not unique_points:
        return f"- Revise key ideas for {topic}.\n- Practice similar questions.\n- Review concepts daily."
    return "\n".join([f"- {point}" for point in unique_points[:4]])


def _generate_topic_recommendation(topic_context, topic):
    focused_source = f"Focus topic: {topic}\n\nStudy content:\n{topic_context}"

    try:
        instruction = (
            "Create deep revision notes for the focus topic, grounded strictly in the study content.\n"
            "- Return 8-12 bullet points.\n"
            "- Include: definition/core idea, key rules/steps, 1-2 examples, and common mistakes.\n"
            "- Keep each bullet short but specific.\n"
            'Return only a strict JSON array of strings (each string is one bullet).'
        )
        items = generate_items_from_source(focused_source, instruction, expected_count=10)
        bullets = []
        for item in items:
            if isinstance(item, str):
                bullets.append(item.strip())
            elif isinstance(item, dict) and item.get("text"):
                bullets.append(str(item.get("text")).strip())
            else:
                bullets.append(str(item).strip())
        bullets = [b for b in bullets if b][:12]
        summary = "\n".join([f"- {bullet}" for bullet in bullets]) if bullets else ""
    except Exception:
        if topic_context:
            lines = [line.strip() for line in str(topic_context).splitlines() if line.strip()]
            picked = lines[:6]
            summary = "\n".join([f"- {line}" for line in picked]) if picked else ""
        if not summary:
            summary = _build_local_revision_summary(topic, [], [])
    return {
        "topic": topic,
        "summary": summary,
    }


def _normalize_mode(value):
    mode = str(value or "").strip().lower()
    aliases = {
        "mcq": "mcq",
        "mcqs": "mcq",
        "flashcard": "flashcards",
        "flashcards": "flashcards",
        "true_false": "true_false",
        "true-false": "true_false",
        "truefalse": "true_false",
        "fill_blanks": "fill_blanks",
        "fill-blanks": "fill_blanks",
        "fillblanks": "fill_blanks",
        "fill_in_the_blanks": "fill_blanks",
    }
    return aliases.get(mode, "")


def _parse_bool(value):
    if isinstance(value, bool):
        return value
    raw = str(value or "").strip().lower()
    if raw in {"true", "t", "1", "yes", "y"}:
        return True
    if raw in {"false", "f", "0", "no", "n"}:
        return False
    return None


def _fill_answer_matches(selected, correct):
    return str(selected or "").strip().lower() == str(correct or "").strip().lower()


def _topic_context_for_mode(mode, items, topic):
    chunks = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        if _safe_topic(item.get("topic")) != topic:
            continue

        if mode == "mcq":
            question = str(item.get("question", "")).strip()
            options = item.get("options", []) if isinstance(item.get("options"), list) else []
            answer = str(item.get("answer", "")).strip()
            explanation = str(item.get("explanation", "")).strip()
            option_text = " | ".join([str(opt) for opt in options[:4]])
            chunks.append(f"Q: {question}\nOptions: {option_text}\nCorrect: {answer}\nWhy: {explanation}")
        elif mode == "flashcards":
            front = str(item.get("front", "")).strip()
            back = str(item.get("back", "")).strip()
            chunks.append(f"Flashcard:\nQ: {front}\nA: {back}")
        elif mode == "true_false":
            statement = str(item.get("statement", "")).strip()
            answer = "True" if bool(item.get("answer")) else "False"
            explanation = str(item.get("explanation", "")).strip()
            chunks.append(f"Statement: {statement}\nCorrect: {answer}\nWhy: {explanation}")
        elif mode == "fill_blanks":
            prompt = str(item.get("prompt", "")).strip()
            answer = str(item.get("answer", "")).strip()
            explanation = str(item.get("explanation", "")).strip()
            chunks.append(f"Prompt: {prompt}\nCorrect: {answer}\nWhy: {explanation}")

    text = "\n\n".join(chunks)
    if len(text) > RECOMMEND_SOURCE_CHAR_LIMIT:
        return text[:RECOMMEND_SOURCE_CHAR_LIMIT]
    return text


def _compute_topic_stats_from_content(mode, items, attempts):
    by_topic = {}
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue

        # Only score attempted items.
        attempt_value = attempts.get(str(index), None)
        if attempt_value is None and index in attempts:
            attempt_value = attempts.get(index)
        if attempt_value is None:
            continue

        topic = _safe_topic(item.get("topic"))
        correct = False

        if mode == "mcq":
            selected_answer = str(attempt_value or "").strip()
            if not selected_answer:
                continue
            correct_answer = str(item.get("answer", "")).strip()
            options = item.get("options", []) if isinstance(item.get("options"), list) else []
            correct_index = resolve_correct_index(options, correct_answer)
            selected_index = resolve_selected_index(options, selected_answer)
            if correct_index != -1 and selected_index != -1:
                correct = correct_index == selected_index
            else:
                correct = is_correct_option(selected_answer, correct_answer)
        elif mode == "true_false":
            selected_bool = _parse_bool(attempt_value)
            if selected_bool is None:
                continue
            correct = selected_bool == bool(item.get("answer"))
        elif mode == "fill_blanks":
            selected_text = str(attempt_value or "").strip()
            if not selected_text:
                continue
            correct = _fill_answer_matches(selected_text, item.get("answer", ""))
        elif mode == "flashcards":
            known = _parse_bool(attempt_value)
            if known is None:
                continue
            # Treat "known" as correct, "needs review" as incorrect.
            correct = bool(known)
        else:
            continue

        entry = by_topic.setdefault(topic, {"correct": 0, "total": 0})
        entry["total"] += 1
        entry["correct"] += 1 if correct else 0

    return by_topic


def _attempt_value(attempts, index):
    value = attempts.get(str(index), None)
    if value is None and index in attempts:
        value = attempts.get(index)
    return value


def _mistakes_from_content(mode, items, attempts):
    mistakes = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        attempt_value = _attempt_value(attempts, index)
        if attempt_value is None:
            continue

        topic = _safe_topic(item.get("topic"))
        explanation = str(item.get("explanation", "")).strip()
        correct = False
        your_answer = attempt_value
        correct_answer = ""

        if mode == "mcq":
            selected_answer = str(attempt_value or "").strip()
            if not selected_answer:
                continue
            correct_answer = str(item.get("answer", "")).strip()
            options = item.get("options", []) if isinstance(item.get("options"), list) else []
            correct_index = resolve_correct_index(options, correct_answer)
            selected_index = resolve_selected_index(options, selected_answer)
            if correct_index != -1 and selected_index != -1:
                correct = correct_index == selected_index
            else:
                correct = is_correct_option(selected_answer, correct_answer)
            if correct:
                continue
            mistakes.append(
                {
                    "index": index,
                    "topic": topic,
                    "type": "mcq",
                    "question": str(item.get("question", "")).strip(),
                    "yourAnswer": selected_answer,
                    "correctAnswer": correct_answer,
                    "explanation": explanation,
                }
            )
            continue

        if mode == "true_false":
            selected_bool = _parse_bool(attempt_value)
            if selected_bool is None:
                continue
            correct_bool = bool(item.get("answer"))
            correct = selected_bool == correct_bool
            if correct:
                continue
            mistakes.append(
                {
                    "index": index,
                    "topic": topic,
                    "type": "true_false",
                    "statement": str(item.get("statement", "")).strip(),
                    "yourAnswer": "True" if selected_bool else "False",
                    "correctAnswer": "True" if correct_bool else "False",
                    "explanation": explanation,
                }
            )
            continue

        if mode == "fill_blanks":
            selected_text = str(attempt_value or "").strip()
            if not selected_text:
                continue
            correct_answer = str(item.get("answer", "")).strip()
            correct = _fill_answer_matches(selected_text, correct_answer)
            if correct:
                continue
            mistakes.append(
                {
                    "index": index,
                    "topic": topic,
                    "type": "fill_blanks",
                    "prompt": str(item.get("prompt", "")).strip(),
                    "yourAnswer": selected_text,
                    "correctAnswer": correct_answer,
                    "explanation": explanation,
                }
            )
            continue

        if mode == "flashcards":
            known = _parse_bool(attempt_value)
            if known is None:
                continue
            correct = bool(known)
            if correct:
                continue
            mistakes.append(
                {
                    "index": index,
                    "topic": topic,
                    "type": "flashcards",
                    "front": str(item.get("front", "")).strip(),
                    "back": str(item.get("back", "")).strip(),
                    "yourAnswer": "Need review",
                    "correctAnswer": "I knew this",
                    "explanation": explanation,
                }
            )

    return mistakes


def _revision_plan_from_mistakes(mistakes, max_topics=4, max_points_per_topic=4):
    by_topic = {}
    for mistake in mistakes:
        topic = _safe_topic(mistake.get("topic"))
        entry = by_topic.setdefault(topic, {"wrong": 0, "points": []})
        entry["wrong"] += 1
        explanation = str(mistake.get("explanation", "")).strip()
        if explanation:
            entry["points"].append(explanation)
        else:
            if mistake.get("question"):
                entry["points"].append(str(mistake.get("question", "")).strip())
            elif mistake.get("statement"):
                entry["points"].append(str(mistake.get("statement", "")).strip())
            elif mistake.get("prompt"):
                entry["points"].append(str(mistake.get("prompt", "")).strip())
            elif mistake.get("front"):
                entry["points"].append(str(mistake.get("front", "")).strip())

    def unique(items):
        seen = set()
        out = []
        for item in items:
            key = str(item or "").strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            out.append(str(item).strip())
        return out

    topics_sorted = sorted(by_topic.items(), key=lambda kv: kv[1]["wrong"], reverse=True)
    plan = []
    for topic, data in topics_sorted[: max(1, max_topics)]:
        points = unique(data.get("points", []))[: max(1, max_points_per_topic)]
        plan.append({"topic": topic, "wrong": int(data.get("wrong", 0) or 0), "points": points})
    return plan


def _concept_explanations_from_mistakes(mode, items, mistakes, max_topics=4):
    by_topic = {}
    for mistake in mistakes:
        topic = _safe_topic(mistake.get("topic"))
        entry = by_topic.setdefault(topic, {"wrong": 0})
        entry["wrong"] += 1

    topics_sorted = sorted(by_topic.items(), key=lambda kv: kv[1]["wrong"], reverse=True)
    concept_blocks = []
    for topic, meta in topics_sorted[: max(1, max_topics)]:
        topic_context = _topic_context_for_mode(mode, items, topic)
        if not topic_context:
            topic_context = _topic_context_for_mode(mode, items, "General")
        focused_source = f"Explain topic: {topic}\n\nStudy content:\n{topic_context or 'No content available.'}"
        explanation = ""
        try:
            instruction = (
                "Explain the focus topic clearly for a student who answered questions wrong.\n"
                "- Return 8-12 bullet points.\n"
                "- Include: definition/core idea, key rules, a small example, and common mistakes.\n"
                "- Keep it grounded strictly in the study content.\n"
                'Return only a strict JSON array of strings (each string is one bullet).'
            )
            items_out = generate_items_from_source(focused_source, instruction, expected_count=10)
            bullets = []
            for item in items_out:
                if isinstance(item, str):
                    bullets.append(item.strip())
                else:
                    bullets.append(str(item).strip())
            bullets = [b for b in bullets if b][:12]
            explanation = "\n".join([f"- {b}" for b in bullets]) if bullets else ""
        except Exception:
            explanation = ""

        if not explanation:
            # Fallback: use unique explanations from the wrong answers themselves.
            points = []
            for mistake in mistakes:
                if _safe_topic(mistake.get("topic")) != topic:
                    continue
                value = str(mistake.get("explanation", "")).strip()
                if value:
                    points.append(value)
            seen = set()
            unique_points = []
            for point in points:
                key = point.lower()
                if key in seen:
                    continue
                seen.add(key)
                unique_points.append(point)
            unique_points = unique_points[:8]
            explanation = "\n".join([f"- {p}" for p in unique_points]) if unique_points else f"- Revise the core ideas for {topic}."

        concept_blocks.append(
            {
                "topic": topic,
                "wrong": int(meta.get("wrong", 0) or 0),
                "explanation": explanation,
            }
        )

    return concept_blocks


@router.post("/api/recommend/knowledge-gaps/content")
def recommend_knowledge_gaps_from_content(payload: dict = Body(default=None)):
    try:
        payload = payload or {}
        mode = _normalize_mode(payload.get("mode"))
        items = payload.get("items", []) or []
        attempts = payload.get("attempts", {}) or {}
        threshold = float(payload.get("threshold", 0.6))

        if not mode:
            return JSONResponse(content={"error": "mode must be one of: mcq, flashcards, true_false, fill_blanks"}, status_code=400)
        if not isinstance(items, list) or len(items) == 0:
            return JSONResponse(content={"error": "items must be a non-empty array"}, status_code=400)
        if not isinstance(attempts, dict):
            return JSONResponse(content={"error": "attempts must be an object"}, status_code=400)

        topic_stats = _compute_topic_stats_from_content(mode, items, attempts)
        mistakes = _mistakes_from_content(mode, items, attempts)
        revision_plan = _revision_plan_from_mistakes(mistakes)
        concept_explanations = _concept_explanations_from_mistakes(mode, items, mistakes)
        topic_results = []
        weak_topics = []
        for topic, stats in topic_stats.items():
            total = int(stats.get("total", 0) or 0)
            correct = int(stats.get("correct", 0) or 0)
            accuracy = (correct / total) if total > 0 else 0.0
            entry = {
                "topic": topic,
                "correct": correct,
                "total": total,
                "accuracy": round(accuracy, 4),
            }
            topic_results.append(entry)
            if total > 0 and accuracy < threshold:
                weak_topics.append(entry)

        weak_topics.sort(key=lambda value: value["accuracy"])
        weak_topics = weak_topics[: max(1, RECOMMEND_MAX_WEAK_TOPICS)]

        recommendations = []
        for weak_topic in weak_topics:
            topic = weak_topic["topic"]
            topic_context = _topic_context_for_mode(mode, items, topic)
            if not topic_context:
                topic_context = any_context() or "No source available."
            rec = _generate_topic_recommendation(topic_context, topic)
            recommendations.append(rec)

        return {
            "weakTopics": weak_topics,
            "topicAccuracy": topic_results,
            "recommendedStudy": recommendations,
            "revisionPlan": revision_plan,
            "conceptExplanations": concept_explanations,
        }
    except ValueError as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=400)
    except RuntimeError as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=502)
    except Exception as exc:
        return JSONResponse(content={"error": f"Unexpected server error: {exc}"}, status_code=500)


@router.post("/api/recommend/knowledge-gaps")
def recommend_knowledge_gaps(payload: dict = Body(default=None)):
    try:
        payload = payload or {}
        mcq_set_id = str(payload.get("mcqSetId", "")).strip()
        selected_answers = payload.get("selectedAnswers", {}) or {}
        threshold = float(payload.get("threshold", 0.6))

        if not mcq_set_id:
            return JSONResponse(content={"error": "mcqSetId is required"}, status_code=400)
        if not isinstance(selected_answers, dict):
            return JSONResponse(content={"error": "selectedAnswers must be an object"}, status_code=400)

        session_data = get_mcq_session(mcq_set_id)
        if not session_data:
            return JSONResponse(content={"error": "MCQ session expired. Generate study set again."}, status_code=410)

        items = session_data.get("items", []) or []
        answers = session_data.get("answers", []) or []
        source_text = str(session_data.get("source_text", "")).strip()

        topic_stats = _compute_topic_stats(items, answers, selected_answers)
        topic_results = []
        weak_topics = []
        for topic, stats in topic_stats.items():
            total = stats["total"]
            correct = stats["correct"]
            accuracy = (correct / total) if total > 0 else 0.0
            entry = {
                "topic": topic,
                "correct": correct,
                "total": total,
                "accuracy": round(accuracy, 4),
            }
            topic_results.append(entry)
            if total > 0 and accuracy < threshold:
                weak_topics.append(entry)

        weak_topics.sort(key=lambda value: value["accuracy"])
        weak_topics = weak_topics[: max(1, RECOMMEND_MAX_WEAK_TOPICS)]
        recommendations = []
        for weak_topic in weak_topics:
            topic_context = _topic_context(items, answers, weak_topic["topic"])
            if not topic_context and source_text:
                topic_context = source_text[:RECOMMEND_SOURCE_CHAR_LIMIT]
            rec = _generate_topic_recommendation(topic_context or "No source available.", weak_topic["topic"])
            recommendations.append(rec)

        return {
            "weakTopics": weak_topics,
            "topicAccuracy": topic_results,
            "recommendedStudy": recommendations,
        }
    except ValueError as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=400)
    except RuntimeError as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=502)
    except Exception as exc:
        return JSONResponse(content={"error": f"Unexpected server error: {exc}"}, status_code=500)
        def any_context(limit=14):
            chunks = []
            for index, item in enumerate(items[: max(1, limit)]):
                if not isinstance(item, dict):
                    continue
                if mode == "mcq":
                    question = str(item.get("question", "")).strip()
                    options = item.get("options", []) if isinstance(item.get("options"), list) else []
                    answer = str(item.get("answer", "")).strip()
                    explanation = str(item.get("explanation", "")).strip()
                    option_text = " | ".join([str(opt) for opt in options[:4]])
                    chunks.append(f"Q: {question}\nOptions: {option_text}\nCorrect: {answer}\nWhy: {explanation}")
                elif mode == "flashcards":
                    front = str(item.get("front", "")).strip()
                    back = str(item.get("back", "")).strip()
                    chunks.append(f"Flashcard:\nQ: {front}\nA: {back}")
                elif mode == "true_false":
                    statement = str(item.get("statement", "")).strip()
                    answer = "True" if bool(item.get("answer")) else "False"
                    explanation = str(item.get("explanation", "")).strip()
                    chunks.append(f"Statement: {statement}\nCorrect: {answer}\nWhy: {explanation}")
                elif mode == "fill_blanks":
                    prompt = str(item.get("prompt", "")).strip()
                    answer = str(item.get("answer", "")).strip()
                    explanation = str(item.get("explanation", "")).strip()
                    chunks.append(f"Prompt: {prompt}\nCorrect: {answer}\nWhy: {explanation}")
            text = "\n\n".join(chunks)
            if len(text) > RECOMMEND_SOURCE_CHAR_LIMIT:
                return text[:RECOMMEND_SOURCE_CHAR_LIMIT]
            return text
