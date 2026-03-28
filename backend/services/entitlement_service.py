import os
import time
from datetime import datetime, timezone

try:
    from firebase_admin import firestore
except Exception:  # pragma: no cover
    firestore = None

from services.firestore_service import get_firestore_db, FIREBASE_INIT_ERROR


FIREBASE_ENTITLEMENTS_COLLECTION = os.getenv("FIREBASE_ENTITLEMENTS_COLLECTION", "user_entitlements")


def _now():
    return datetime.now(timezone.utc).isoformat(), int(time.time())


def get_user_entitlement(user_id: str):
    db = get_firestore_db()
    if db is None:
        return None, FIREBASE_INIT_ERROR or "Firebase is not configured"
    if not user_id:
        return None, "userId is required"
    try:
        ref = db.collection(FIREBASE_ENTITLEMENTS_COLLECTION).document(str(user_id))
        snap = ref.get()
        if not snap.exists:
            return None, ""
        data = snap.to_dict() or {}
        return data, ""
    except Exception:
        return None, "Failed to load entitlement"


def set_user_entitlement(
    user_id: str,
    plan: str,
    expires_at_epoch: int,
    *,
    email: str = "",
    stripe_customer_id: str = "",
    stripe_checkout_session_id: str = "",
    stripe_payment_intent_id: str = "",
):
    db = get_firestore_db()
    if db is None:
        return False, FIREBASE_INIT_ERROR or "Firebase is not configured"
    if not user_id:
        return False, "userId is required"
    plan = str(plan or "").strip().lower()
    if plan not in {"silver", "gold", "platinum"}:
        return False, "Invalid plan"
    try:
        expires_at_epoch = int(expires_at_epoch)
    except Exception:
        return False, "Invalid expiry"
    now_iso, now_epoch = _now()
    doc = {
        "userId": str(user_id),
        "email": str(email or "").strip()[:320],
        "plan": plan,
        "active": True,
        "expiresAtEpoch": expires_at_epoch,
        "updatedAt": now_iso,
        "updatedAtEpoch": now_epoch,
        "stripeCustomerId": str(stripe_customer_id or "").strip()[:120],
        "stripeCheckoutSessionId": str(stripe_checkout_session_id or "").strip()[:120],
        "stripePaymentIntentId": str(stripe_payment_intent_id or "").strip()[:120],
    }
    try:
        ref = db.collection(FIREBASE_ENTITLEMENTS_COLLECTION).document(str(user_id))
        ref.set(doc)
        return True, ""
    except Exception:
        return False, "Failed to save entitlement"

