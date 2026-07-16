"""In-process clock override for demo/debug purposes.

Services should call ``now_utc()`` / ``now_in(tz)`` instead of
``datetime.now(timezone.utc)`` so the debug UI can pin the clock to
a fixed moment for testing time-sensitive flows.
"""

from datetime import datetime, timezone, tzinfo
from threading import Lock

_lock = Lock()
_override: datetime | None = None


def set_override(dt: datetime | None) -> None:
    global _override
    if dt is not None and dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    with _lock:
        _override = dt


def get_override() -> datetime | None:
    with _lock:
        return _override


def now_utc() -> datetime:
    with _lock:
        if _override is not None:
            return _override.astimezone(timezone.utc)
    return datetime.now(timezone.utc)


def now_in(tz: tzinfo) -> datetime:
    return now_utc().astimezone(tz)
