from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.admins.services.admin_analytics_service import AdminAnalyticsService
from core.helpers.db_helper import db_helper
from core.schemas.admin import AnalyticsDailyItem, AnalyticsSummaryOut

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(db_helper.session_getter)]


@router.get("/analytics/summary", response_model=AnalyticsSummaryOut)
async def get_summary(
    session: SessionDep,
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
) -> AnalyticsSummaryOut:
    return await AdminAnalyticsService.summary(session, date_from, date_to)


@router.get("/analytics/daily", response_model=list[AnalyticsDailyItem])
async def get_daily(
    session: SessionDep,
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
) -> list[AnalyticsDailyItem]:
    return await AdminAnalyticsService.daily(session, date_from, date_to)
