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
    if not PEXELS_API_KEY:
        return None
    q = _clean_query(query)
    if not q:
        return None

    url = "https://api.pexels.com/v1/search"
    headers = {"Authorization": PEXELS_API_KEY}
    params = {
        "query": q,
        "per_page": 1,
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
        return None

    photo = photos[0] if isinstance(photos[0], dict) else None
    if not photo:
        return None
    src = photo.get("src") if isinstance(photo.get("src"), dict) else {}
    image_url = (
        src.get("large")
        or src.get("medium")
        or src.get("landscape")
        or src.get("large2x")
        or src.get("original")
        or ""
    )
    page_url = str(photo.get("url") or "").strip()
    if not image_url:
        return None
    return str(image_url), page_url

