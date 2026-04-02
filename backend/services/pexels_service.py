import os
import re
from typing import Optional, Tuple

import requests


PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "").strip()


def _clean_query(value: str) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9\\s_-]+", " ", text)
    text = re.sub(r"\\s+", " ", text).strip()
    return text[:120]


def search_photo(query: str) -> Optional[Tuple[str, str]]:
    """
    Returns (image_url, page_url) or None.
    Uses Pexels API. Requires PEXELS_API_KEY in environment.
    """
    photos = search_photos(query, per_page=1)
    if not photos:
        return None
    image_url, page_url, _photo_id = photos[0]
    return image_url, page_url


def search_photos(query: str, per_page: int = 6) -> list[Tuple[str, str, str]]:
    """
    Returns list[(image_url, page_url, photo_id)].
    Uses Pexels API. Requires PEXELS_API_KEY in environment.
    """
    if not PEXELS_API_KEY:
        return []
    q = _clean_query(query)
    if not q:
        return []

    per_page = max(1, min(int(per_page or 6), 10))
    url = "https://api.pexels.com/v1/search"
    headers = {"Authorization": PEXELS_API_KEY}
    params = {
        "query": q,
        "per_page": per_page,
        "orientation": "landscape",
        "size": "medium",
    }
    resp = requests.get(url, headers=headers, params=params, timeout=15)
    data = resp.json() if resp.content else {}
    if resp.status_code >= 400:
        message = data.get("error") or "Pexels API error"
        raise RuntimeError(message)

    photos = data.get("photos") if isinstance(data, dict) else None
    if not isinstance(photos, list) or not photos:
        return []

    results: list[Tuple[str, str, str]] = []
    for row in photos:
        if not isinstance(row, dict):
            continue
        src = row.get("src") if isinstance(row.get("src"), dict) else {}
        image_url = (
            src.get("large")
            or src.get("medium")
            or src.get("landscape")
            or src.get("large2x")
            or src.get("original")
            or ""
        )
        page_url = str(row.get("url") or "").strip()
        photo_id = str(row.get("id") or "").strip()
        if not image_url:
            continue
        results.append((str(image_url), page_url, photo_id))
    return results
