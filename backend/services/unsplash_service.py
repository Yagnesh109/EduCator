import os
import re
from typing import Optional, Tuple

import requests


UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY", "").strip()
# Optional: show as utm_source in attribution links (Unsplash guidelines).
UNSPLASH_APP_NAME = os.getenv("UNSPLASH_APP_NAME", "EduCator").strip() or "EduCator"


def _clean_query(value: str) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9\\s_-]+", " ", text)
    text = re.sub(r"\\s+", " ", text).strip()
    return text[:120]


def _with_utm(url: str) -> str:
    url = str(url or "").strip()
    if not url:
        return ""
    joiner = "&" if "?" in url else "?"
    return f"{url}{joiner}utm_source={UNSPLASH_APP_NAME}&utm_medium=referral"


def search_photo(query: str) -> Optional[Tuple[str, str, str, str]]:
    """
    Returns (image_url, page_url, author_name, author_url) or None.
    Uses Unsplash API. Requires UNSPLASH_ACCESS_KEY in environment.
    """
    photos = search_photos(query, per_page=1)
    if not photos:
        return None
    image_url, page_url, author_name, author_url, _photo_id = photos[0]
    return image_url, page_url, author_name, author_url


def search_photos(query: str, per_page: int = 6) -> list[Tuple[str, str, str, str, str]]:
    """
    Returns list[(image_url, page_url, author_name, author_url, photo_id)].
    Uses Unsplash API. Requires UNSPLASH_ACCESS_KEY in environment.
    """
    if not UNSPLASH_ACCESS_KEY:
        return []
    q = _clean_query(query)
    if not q:
        return []

    per_page = max(1, min(int(per_page or 6), 10))
    url = "https://api.unsplash.com/search/photos"
    headers = {"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}", "Accept-Version": "v1"}
    params = {
        "query": q,
        "per_page": per_page,
        "orientation": "landscape",
        "content_filter": "high",
    }
    resp = requests.get(url, headers=headers, params=params, timeout=15)
    data = resp.json() if resp.content else {}
    if resp.status_code >= 400:
        errors = data.get("errors") if isinstance(data, dict) else None
        message = (errors[0] if isinstance(errors, list) and errors else None) or "Unsplash API error"
        raise RuntimeError(message)

    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list) or not results:
        return []

    out: list[Tuple[str, str, str, str, str]] = []
    for photo in results:
        if not isinstance(photo, dict):
            continue
        urls = photo.get("urls") if isinstance(photo.get("urls"), dict) else {}
        links = photo.get("links") if isinstance(photo.get("links"), dict) else {}
        user = photo.get("user") if isinstance(photo.get("user"), dict) else {}
        user_links = user.get("links") if isinstance(user.get("links"), dict) else {}

        image_url = str(urls.get("regular") or urls.get("small") or urls.get("raw") or "").strip()
        page_url = _with_utm(str(links.get("html") or "").strip())
        author_name = str(user.get("name") or user.get("username") or "").strip()
        author_url = _with_utm(str(user_links.get("html") or "").strip())
        photo_id = str(photo.get("id") or "").strip()

        if not image_url:
            continue
        out.append((image_url, page_url, author_name, author_url, photo_id))
    return out
