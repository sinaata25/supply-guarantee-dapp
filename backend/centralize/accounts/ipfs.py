"""Pinata IPFS pinning helper.

Docs: https://docs.pinata.cloud/api-reference/endpoint/pin-file-to-ipfs
"""
import json
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def pinata_configured() -> bool:
    return bool(
        getattr(settings, "PINATA_JWT", "")
        or (getattr(settings, "PINATA_API_KEY", "") and getattr(settings, "PINATA_API_SECRET", ""))
    )


def _auth_headers() -> dict:
    if settings.PINATA_JWT:
        return {"Authorization": f"Bearer {settings.PINATA_JWT}"}
    return {
        "pinata_api_key": settings.PINATA_API_KEY,
        "pinata_secret_api_key": settings.PINATA_API_SECRET,
    }


def pin_file(*, file_obj, filename: str, uploader: str = "") -> dict:
    """Pin a file to IPFS via Pinata.

    Returns {"ok": True, "cid": "Qm..."} or {"ok": False, "detail": ...}.
    cidVersion is forced to 0 so the CID is always a base58 sha2-256 multihash
    (Qm...) whose 32-byte digest fits the contract's bytes32 DocSlot.
    """
    if not pinata_configured():
        return {"ok": False, "detail": "Pinata credentials not configured (set PINATA_JWT or PINATA_API_SECRET)"}

    options = {"cidVersion": 0}
    metadata = {"name": filename or "document"}
    if uploader:
        metadata["keyvalues"] = {"uploader": uploader}

    try:
        resp = requests.post(
            settings.PINATA_PIN_URL,
            headers=_auth_headers(),
            files={"file": (filename or "document", file_obj)},
            data={
                "pinataOptions": json.dumps(options),
                "pinataMetadata": json.dumps(metadata),
            },
            timeout=120,
        )
    except requests.RequestException as e:
        logger.warning("Pinata request failed: %s", e)
        return {"ok": False, "detail": f"request error: {e}"}

    try:
        data = resp.json()
    except ValueError:
        data = {"raw": resp.text}

    if resp.status_code >= 400:
        logger.warning("Pinata pin failed (status=%s): %s", resp.status_code, data)
        return {"ok": False, "detail": data}

    cid = data.get("IpfsHash", "")
    if not cid:
        return {"ok": False, "detail": data}
    return {"ok": True, "cid": cid}
