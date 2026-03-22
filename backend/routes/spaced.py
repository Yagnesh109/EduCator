import time
import hashlib
from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse
from services.firestore_service import save_spaced_plan, load_spaced_plan

router = APIRouter()


def _card_id(front: str, back: str) -> str:
    text = (front or "") + "::" + (back or "")
    return hashlib.sha1(text.encode("utf-8", "ignore")).hexdigest()


def _next_box(current_box: int, known: bool) -> int:
    if known:
        return min(5, max(1, current_box + 1))
    return 1


def _interval_days(box: int) -> int:
    return {1: 1, 2: 2, 3: 4, 4: 7, 5: 14}.get(max(1, min(5, int(box))), 1)


@router.post("/api/spaced/schedule")
def spaced_schedule(payload: dict = Body(default=None)):
    """
    Compute a lightweight spaced-repetition plan (Leitner-style).
    Inputs:
      - flashcards: list[{front, back, topic?}]
      - marks: map[cardId|index] -> 'known' | 'review'
      - previous: map[cardId] -> box (1-5)  (optional)
    Returns:
      schedule: list[{cardId, front, back, box, intervalDays, dueAtEpoch, dueAtIso}]
      boxes: map[cardId] -> box
    """
    try:
        flashcards = payload.get("flashcards") if isinstance(payload, dict) else []
        marks = payload.get("marks") if isinstance(payload, dict) else {}
        previous = payload.get("previous") if isinstance(payload, dict) else {}
        now = int(time.time())

        boxes = {}
        schedule = []
        for idx, card in enumerate(flashcards or []):
            front = str(card.get("front", "")).strip()
            back = str(card.get("back", "")).strip()
            if not front or not back:
                continue
            card_id = _card_id(front, back)
            prev_box = int(previous.get(card_id, 1) or 1)
            mark_key = str(idx)
            mark = marks.get(mark_key) or marks.get(card_id)
            known = str(mark or "").lower() in {"known", "easy", "good", "true"}
            box = _next_box(prev_box, known) if mark is not None else prev_box
            interval = _interval_days(box)
            due_at = now + interval * 86400
            boxes[card_id] = box
            schedule.append(
                {
                    "cardId": card_id,
                    "front": front,
                    "back": back,
                    "topic": card.get("topic", ""),
                    "box": box,
                    "intervalDays": interval,
                    "dueAtEpoch": due_at,
                    "dueAtIso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(due_at)),
                }
            )

        # sort soonest due first
        schedule.sort(key=lambda item: item["dueAtEpoch"])
        return {"schedule": schedule, "boxes": boxes}
    except Exception as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=400)


@router.post("/api/spaced/save")
def spaced_save(payload: dict = Body(default=None)):
    try:
        payload = payload or {}
        user_id = str(payload.get("userId", "")).strip()
        plan_id = str(payload.get("planId", "")).strip()
        boxes = payload.get("boxes") if isinstance(payload.get("boxes"), dict) else {}
        schedule = payload.get("schedule") if isinstance(payload.get("schedule"), list) else []
        ok, message = save_spaced_plan(user_id, plan_id, boxes, schedule)
        if not ok:
            return JSONResponse(content={"error": message}, status_code=400)
        return {"stored": True}
    except Exception as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=400)


@router.post("/api/spaced/load")
def spaced_load(payload: dict = Body(default=None)):
    try:
        payload = payload or {}
        user_id = str(payload.get("userId", "")).strip()
        plan_id = str(payload.get("planId", "")).strip()
        data, message = load_spaced_plan(user_id, plan_id)
        if message:
            return JSONResponse(content={"error": message}, status_code=400)
        return data or {"boxes": {}, "schedule": []}
    except Exception as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=400)
