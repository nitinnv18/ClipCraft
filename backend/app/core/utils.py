import os
import time
import re
from urllib.parse import urlparse
from datetime import datetime, timezone
from typing import Optional, Any
from app.core.logging import logger

def utc_now() -> datetime:
    """Return current naive UTC datetime for backwards-compatible database storage."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

def extract_youtube_id(url_or_id: Optional[str]) -> Optional[str]:
    """Canonical extractor for 11-character YouTube video IDs with SSRF prevention."""
    if not url_or_id:
        return None
    cleaned = url_or_id.strip()
    if len(cleaned) == 11 and re.match(r'^[a-zA-Z0-9_-]{11}$', cleaned):
        return cleaned

    try:
        parsed = urlparse(cleaned)
        if parsed.scheme and parsed.netloc:
            netloc = parsed.netloc.lower().split(":")[0]
            allowed = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
            if not any(netloc == d or netloc.endswith("." + d) for d in allowed):
                return None
    except Exception:
        return None

    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11})',
        r'(?:youtu\.be\/)([0-9A-Za-z_-]{11})',
        r'(?:shorts\/)([0-9A-Za-z_-]{11})',
        r'(?:embed\/)([0-9A-Za-z_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, cleaned)
        if match:
            return match.group(1)
    return None

def cleanup_orphaned_temp_files(temp_dir: str, max_age_hours: float = 2.0, public_retention_days: float = 7.0) -> int:
    """
    Remove orphaned folders and files in temp_dir that have not been modified for max_age_hours.
    Also prunes local public_media files older than public_retention_days to prevent disk exhaustion.
    Returns count of removed items.
    """
    cleaned = 0
    now = time.time()
    cutoff = now - (max_age_hours * 3600)
    public_cutoff = now - (public_retention_days * 86400)

    if not os.path.exists(temp_dir):
        return 0

    public_dir = os.path.abspath(os.path.join(temp_dir, "public_media"))

    for root, dirs, files in os.walk(temp_dir, topdown=False):
        abs_root = os.path.abspath(root)
        is_public_asset = abs_root == public_dir or abs_root.startswith(public_dir + os.sep)
        active_cutoff = public_cutoff if is_public_asset else cutoff

        for f in files:
            if f == ".gitkeep":
                continue
            fp = os.path.join(root, f)
            try:
                if os.path.getmtime(fp) < active_cutoff:
                    os.remove(fp)
                    cleaned += 1
            except Exception as e:
                logger.warning(f"Error while cleaning up temporary file {fp}: {e}")

        for d in dirs:
            dp = os.path.join(root, d)
            abs_dp = os.path.abspath(dp)
            if abs_dp == public_dir:
                continue
            try:
                if not os.listdir(dp) and os.path.getmtime(dp) < active_cutoff:
                    os.rmdir(dp)
                    cleaned += 1
            except Exception:
                pass

    return cleaned

def format_iso_utc(dt: Any) -> Optional[str]:
    """
    Format any date/time into a strict UTC ISO-8601 string ending with 'Z'.
    Prevents client browsers from misinterpreting UTC datetimes as local time.
    """
    if dt is None or dt == "":
        return None
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    s = str(dt).strip()
    if not s:
        return None
    if " " in s and "T" not in s:
        s = s.replace(" ", "T")
    if not s.endswith("Z") and not ("+" in s[10:] or ("-" in s[10:] and s[10:].count("-") == 1)):
        s += "Z"
    return s

