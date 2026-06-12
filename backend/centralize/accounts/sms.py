"""IPPanel pattern-SMS helper.

Docs: https://docs.ippanel.com/docs/send/pattern
"""
import logging
import time

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# How many times to retry on a transient provider failure (5xx / network).
_MAX_ATTEMPTS = 3
_RETRY_BACKOFF_SECONDS = 1.5


def normalize_iran_msisdn(raw: str):
    """Normalize an Iranian mobile number to +98XXXXXXXXXX.

    Accepts inputs like 0912..., 912..., 98912..., 0098912..., +98912....
    Returns None if it does not look like a valid Iranian mobile number.
    """
    if not raw:
        return None

    digits = "".join(ch for ch in str(raw) if ch.isdigit())

    if digits.startswith("0098"):
        digits = digits[4:]
    elif digits.startswith("98"):
        digits = digits[2:]
    elif digits.startswith("0"):
        digits = digits[1:]

    # At this point we expect a 10-digit subscriber number starting with 9.
    if len(digits) == 10 and digits.startswith("9"):
        return "+98" + digits
    return None


def send_pattern_sms(*, to: str, params: dict) -> dict:
    """Send a pattern SMS via IPPanel.

    Returns {"ok": bool, "detail": <api response or message>}.
    Never raises — callers can treat SMS as best-effort.
    """
    if not getattr(settings, "IPPANEL_ENABLED", True):
        return {"ok": False, "detail": "sms disabled"}

    msisdn = normalize_iran_msisdn(to)
    if not msisdn:
        return {"ok": False, "detail": "invalid phone number"}

    payload = {
        "sending_type": "pattern",
        "from_number": settings.IPPANEL_FROM_NUMBER,
        "code": settings.IPPANEL_PATTERN_CODE,
        "recipients": [msisdn],
        "params": params,
    }
    headers = {
        "Authorization": settings.IPPANEL_API_KEY,
        "Content-Type": "application/json",
    }

    last_detail = "unknown error"
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            resp = requests.post(
                settings.IPPANEL_BASE_URL, json=payload, headers=headers, timeout=15
            )
        except requests.RequestException as e:
            last_detail = f"request error: {e}"
            logger.warning("IPPanel request failed (attempt %s/%s): %s", attempt, _MAX_ATTEMPTS, e)
            if attempt < _MAX_ATTEMPTS:
                time.sleep(_RETRY_BACKOFF_SECONDS)
                continue
            return {"ok": False, "detail": last_detail}

        # JSON body => real API response; HTML/text => provider gateway error page.
        try:
            data = resp.json()
            is_json = isinstance(data, dict)
        except ValueError:
            data = None
            is_json = False

        if resp.status_code >= 500 or not is_json:
            # Transient provider/gateway outage (e.g. edge.ippanel.com 502). Retry.
            last_detail = f"provider unavailable (HTTP {resp.status_code})"
            logger.warning(
                "IPPanel gateway error (attempt %s/%s, status=%s)",
                attempt, _MAX_ATTEMPTS, resp.status_code,
            )
            if attempt < _MAX_ATTEMPTS:
                time.sleep(_RETRY_BACKOFF_SECONDS)
                continue
            return {"ok": False, "detail": last_detail}

        ok = resp.status_code < 400 and bool(data.get("meta", {}).get("status", resp.status_code < 400))
        if not ok:
            logger.warning("IPPanel send rejected (status=%s): %s", resp.status_code, data)
        return {"ok": ok, "detail": data}

    return {"ok": False, "detail": last_detail}
