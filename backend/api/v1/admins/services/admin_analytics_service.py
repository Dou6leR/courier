from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.orders.services.order_service import SERVICE_FEE
from core.debug_clock import now_utc
from core.models.enums import OrderStatus
from core.models.order import Order
from core.models.order_logistics import OrderLogistics
from core.models.payment import Payment
from core.schemas.admin import AnalyticsDailyItem, AnalyticsSummaryOut


def _resolve_range(
    date_from: date | None, date_to: date | None, default_days: int
) -> tuple[datetime, datetime]:
    end_date = date_to or now_utc().date()
    start_date = date_from or (end_date - timedelta(days=default_days))
    start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
    end_dt = datetime.combine(end_date, datetime.max.time(), tzinfo=timezone.utc)
    return start_dt, end_dt


class AdminAnalyticsService:
    @classmethod
    async def summary(
        cls,
        session: AsyncSession,
        date_from: date | None,
        date_to: date | None,
    ) -> AnalyticsSummaryOut:
        start_dt, end_dt = _resolve_range(date_from, date_to, default_days=30)

        row = (
            await session.execute(
                text(
                    "CALL sp_analytics_summary("
                    ":date_from, :date_to, :service_fee,"
                    " NULL, NULL, NULL, NULL, NULL, NULL)"
                ),
                {
                    "date_from": start_dt,
                    "date_to": end_dt,
                    "service_fee": SERVICE_FEE,
                },
            )
        ).one()

        return AnalyticsSummaryOut(
            revenue=float(row[0] or 0),
            total_income=float(row[1] or 0),
            deliveries=int(row[2] or 0),
            completion_rate=float(row[3] or 0),
            active_couriers_count=int(row[4] or 0),
            avg_delivery_time_minutes=(
                float(row[5]) if row[5] is not None else None
            ),
        )

    @classmethod
    async def daily(
        cls,
        session: AsyncSession,
        date_from: date | None,
        date_to: date | None,
    ) -> list[AnalyticsDailyItem]:
        start_dt, end_dt = _resolve_range(date_from, date_to, default_days=7)
        day_col = func.date_trunc("day", Order.created_at).label("day")

        rows = (
            await session.execute(
                select(
                    day_col,
                    func.count(Order.id),
                    func.count(Payment.id),
                    func.coalesce(func.sum(Payment.amount), 0),
                )
                .select_from(Order)
                .outerjoin(
                    Payment,
                    and_(
                        Payment.order_id == Order.id,
                        Payment.paid_at.is_not(None),
                        Payment.refunded_at.is_(None),
                    ),
                )
                .where(
                    Order.status == OrderStatus.DELIVERED,
                    Order.created_at.between(start_dt, end_dt),
                )
                .group_by(day_col)
                .order_by(day_col.asc())
            )
        ).all()

        return [
            AnalyticsDailyItem(
                date=day.date() if isinstance(day, datetime) else day,
                deliveries=int(total),
                revenue=round(float(paid) * SERVICE_FEE, 2),
                total_income=float(income or 0),
            )
            for day, total, paid, income in rows
        ]
