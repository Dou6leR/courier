from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.admins.services.admin_order_service import AdminOrderService
from core.helpers.db_helper import db_helper
from core.schemas.admin import (
    AdminOrderDetailOut,
    AdminOrderOut,
    OrderStatusFilter,
)

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(db_helper.session_getter)]


@router.get("/orders", response_model=list[AdminOrderOut])
async def list_orders(
    session: SessionDep,
    status: OrderStatusFilter = "all",
    search: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[AdminOrderOut]:
    return await AdminOrderService.list_orders(
        session, status, search, limit=limit, offset=offset
    )


@router.get("/orders/{order_id}", response_model=AdminOrderDetailOut)
async def get_order(order_id: int, session: SessionDep) -> AdminOrderDetailOut:
    return await AdminOrderService.get_order(session, order_id)


@router.post("/orders/{order_id}/cancel", response_model=AdminOrderDetailOut)
async def cancel_order(order_id: int, session: SessionDep) -> AdminOrderDetailOut:
    return await AdminOrderService.cancel_order(session, order_id)


@router.post("/orders/{order_id}/refund", response_model=AdminOrderDetailOut)
async def refund_order(order_id: int, session: SessionDep) -> AdminOrderDetailOut:
    return await AdminOrderService.refund_order(session, order_id)
