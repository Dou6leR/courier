from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel

from core import debug_clock

router = APIRouter()


class ClockOut(BaseModel):
    now: datetime
    overridden: bool


class ClockIn(BaseModel):
    now: datetime


@router.get("/now", response_model=ClockOut)
def get_now() -> ClockOut:
    override = debug_clock.get_override()
    return ClockOut(now=debug_clock.now_utc(), overridden=override is not None)


@router.put("/now", response_model=ClockOut)
def set_now(data: ClockIn) -> ClockOut:
    debug_clock.set_override(data.now)
    return ClockOut(now=debug_clock.now_utc(), overridden=True)


@router.delete("/now", response_model=ClockOut)
def clear_now() -> ClockOut:
    debug_clock.set_override(None)
    return ClockOut(now=debug_clock.now_utc(), overridden=False)
