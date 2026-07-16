from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.couriers.services.courier_service import CourierService
from core.auth.dependencies import get_current_user, require_roles
from core.enums import UserRole
from core.helpers.db_helper import db_helper
from core.models.enums import OrderStatus
from core.models.user import User
from core.schemas.courier import (
    CourierAvailabilityIn,
    CourierLocationIn,
    CourierMeOut,
    CourierRouteOut,
    RouteDayOut,
    TransportUpsertIn,
)
from core.schemas.order import OrderOut
from core.schemas.payment import ReceiptOut

router = APIRouter(dependencies=[Depends(require_roles(UserRole.courier))])

SessionDep = Annotated[AsyncSession, Depends(db_helper.session_getter)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]


@router.get("/me", response_model=CourierMeOut)
async def get_me(user: CurrentUserDep, session: SessionDep) -> CourierMeOut:
    return await CourierService.get_me(session, user.id)


@router.post("/me/location", response_model=CourierMeOut)
async def update_location(
    data: CourierLocationIn, user: CurrentUserDep, session: SessionDep
) -> CourierMeOut:
    return await CourierService.update_location(session, user.id, data)


@router.patch("/me", response_model=CourierMeOut)
async def update_me(
    data: CourierAvailabilityIn, user: CurrentUserDep, session: SessionDep
) -> CourierMeOut:
    return await CourierService.update_availability(session, user.id, data)


@router.put("/me/transport", response_model=CourierMeOut)
async def upsert_transport(
    data: TransportUpsertIn, user: CurrentUserDep, session: SessionDep
) -> CourierMeOut:
    return await CourierService.upsert_transport(session, user.id, data)


@router.delete("/me/transport", response_model=CourierMeOut)
async def remove_transport(
    user: CurrentUserDep, session: SessionDep
) -> CourierMeOut:
    return await CourierService.remove_transport(session, user.id)


@router.get("/me/route", response_model=CourierRouteOut)
async def get_route(
    user: CurrentUserDep,
    session: SessionDep,
    plan_date: date | None = Query(default=None, alias="date"),
) -> CourierRouteOut:
    return await CourierService.get_route(session, user.id, plan_date)


@router.get("/me/route/days", response_model=list[RouteDayOut])
async def list_route_days(
    user: CurrentUserDep, session: SessionDep
) -> list[RouteDayOut]:
    return await CourierService.list_route_days(session, user.id)


@router.get("/orders/mine", response_model=list[OrderOut])
async def list_mine(
    user: CurrentUserDep,
    session: SessionDep,
    scope: Literal["today", "upcoming", "all"] = "today",
    period: Literal["last_month", "all"] = "all",
    status: OrderStatus | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[OrderOut]:
    return await CourierService.list_mine(
        session, user.id, scope=scope, period=period, status_filter=status,
        limit=limit, offset=offset,
    )


@router.get("/orders/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: int, user: CurrentUserDep, session: SessionDep
) -> OrderOut:
    return await CourierService.get_order(session, order_id, user.id)


@router.get("/orders/{order_id}/receipt", response_model=ReceiptOut)
async def get_receipt(
    order_id: int, user: CurrentUserDep, session: SessionDep
) -> ReceiptOut:
    from api.v1.payments.services.payment_service import PaymentService

    return await PaymentService.receipt(session, order_id, user.id, is_courier=True)


class OrderStatusIn(BaseModel):
    status: OrderStatus


@router.post("/orders/{order_id}/status", response_model=OrderOut)
async def update_order_status(
    order_id: int,
    data: OrderStatusIn,
    user: CurrentUserDep,
    session: SessionDep,
) -> OrderOut:
    return await CourierService.update_status(session, order_id, user.id, data.status)
