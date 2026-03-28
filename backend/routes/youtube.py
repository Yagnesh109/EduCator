import os
import re
from typing import List

import requests
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from routes.generate import get_source_text_from_request

router = APIRouter()


def _derive_query(text: str, preview: str = "", limit: int = 9) -> str:
    sample = (text or "")[:7000].lower()
    words = re.findall(r"[a-z][a-z0-9_-]{3,}", sample)
    stop = {
        "this",
        "that",
        "with",
        "from",
        "have",
        "about",
        "these",
        "those",
        "which",
        "there",
        "their",
        "your",
        "into",
        "using",
        "they",
        "them",
        "been",
        "will",
        "would",
        "should",
        "could",
        "also",
        "more",
        "most",
        "some",
        "many",
        "such",
        "than",
        "then",
        "when",
        "where",
        "what",
        "why",
        "how",
        "are",
        "was",
        "were",
        "has",
        "had",
        "can",
        "cannot",
        "dont",
        "does",
        "did",
        "each",
        "over",
        "under",
        "between",
    }
    freq = {}
    for w in words:
        if w in stop:
            continue
        freq[w] = freq.get(w, 0) + 1
    ranked = sorted(freq.items(), key=lambda kv: kv[1], reverse=True)
    top = [w for (w, _c) in ranked[:limit]]
    query = " ".join(top).strip()
    if not query:
        query = (preview or "").strip()
    return query or "study guide"


def _youtube_search(api_key: str, query: str, max_results: int = 8) -> List[dict]:
    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "key": api_key,
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": max(1, min(int(max_results or 8), 12)),
        "safeSearch": "moderate",
        "videoEmbeddable": "true",
        "order": "relevance",
        "relevanceLanguage": "en",
    }
    response = requests.get(url, params=params, timeout=15)
    data = response.json() if response.content else {}
    if response.status_code >= 400:
        message = data.get("error", {}).get("message") or data.get("error") or "YouTube API error"
        raise RuntimeError(message)

    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list):
        return []

    results = []
    for item in items:
        try:
            video_id = item.get("id", {}).get("videoId")
            snippet = item.get("snippet", {}) or {}
            thumbs = snippet.get("thumbnails", {}) or {}
            thumb = (
                (thumbs.get("high") or {}).get("url")
                or (thumbs.get("medium") or {}).get("url")
                or (thumbs.get("default") or {}).get("url")
                or ""
            )
            if not video_id:
                continue
            results.append(
                {
                    "videoId": video_id,
                    "title": str(snippet.get("title") or "").strip(),
                    "channelTitle": str(snippet.get("channelTitle") or "").strip(),
                    "publishedAt": str(snippet.get("publishedAt") or "").strip(),
                    "description": str(snippet.get("description") or "").strip(),
                    "thumbnailUrl": thumb,
                }
            )
        except Exception:
            continue
    return results


@router.post("/api/youtube/recommend")
async def recommend_youtube(request: Request):
    try:
        from utils.premium_guard import require_feature

        require_feature(request, "youtube_guide")

        api_key = os.getenv("YOUTUBE_API_KEY", "").strip()
        if not api_key:
            return JSONResponse(
                content={
                    "error": "YouTube API key not configured. Set YOUTUBE_API_KEY in backend/.env and restart backend."
                },
                status_code=503,
            )

        form = await request.form()
        try:
            max_results = int(str(form.get("maxResults") or 8))
        except Exception:
            max_results = 8

        source_text, meta = await get_source_text_from_request(request)
        preview = str(meta.get("sourcePreview") or "").strip()
        query = _derive_query(source_text, preview=preview)

        videos = _youtube_search(api_key, query, max_results=max_results)
        return {"query": query, "videos": videos, "meta": {"sourcePreview": preview}}
    except ValueError as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=400)
    except RuntimeError as exc:
        return JSONResponse(content={"error": str(exc)}, status_code=502)
    except Exception as exc:
        return JSONResponse(content={"error": f"Unexpected server error: {exc}"}, status_code=500)
