from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.orders.services.order_service import OrderService
from api.v1.payments.services.payment_service import PaymentService
from api.v1.reviews.services.review_service import ReviewService
from core.auth.dependencies import get_current_user, require_roles
from core.enums import UserRole
from core.helpers.db_helper import db_helper
from core.models.enums import OrderStatus
from core.models.user import User
from core.schemas.order import OrderConfirmIn, OrderCreateIn, OrderOut
from core.schemas.payment import PaymentOut, ReceiptOut
from core.schemas.review import ReviewCreateIn, ReviewOut

router = APIRouter(dependencies=[Depends(require_roles(UserRole.client))])

SessionDep = Annotated[AsyncSession, Depends(db_helper.session_getter)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]


@router.post("/", response_model=OrderOut, status_code=201)
async def create_order(
    data: OrderCreateIn, user: CurrentUserDep, session: SessionDep
) -> OrderOut:
    return await OrderService.create(session, user.id, data)


@router.get("/mine", response_model=list[OrderOut])
async def list_my_orders(
    user: CurrentUserDep,
    session: SessionDep,
    role: Literal["sender", "recipient", "any"] = "any",
    period: Literal["last_month", "all"] = "all",
    status: OrderStatus | None = Query(default=None),
    archived: bool | None = Query(default=None),
    exclude_awaiting_my_confirmation: bool = Query(default=False),
    limit: int | None = Query(default=None, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[OrderOut]:
    return await OrderService.list_mine(
        session,
        user.id,
        role,
        period,
        status,
        archived,
        exclude_awaiting_my_confirmation,
        limit,
        offset,
    )


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: int, user: CurrentUserDep, session: SessionDep
) -> OrderOut:
    return await OrderService.get_for_user(session, order_id, user.id)


@router.post("/{order_id}/confirm", response_model=OrderOut)
async def confirm_order(
    order_id: int,
    user: CurrentUserDep,
    session: SessionDep,
    data: OrderConfirmIn | None = None,
) -> OrderOut:
    return await OrderService.confirm(session, order_id, user.id, data)


@router.post("/{order_id}/pay", response_model=PaymentOut)
async def pay_order(
    order_id: int, user: CurrentUserDep, session: SessionDep
) -> PaymentOut:
    return await PaymentService.pay(session, order_id, user.id)


@router.get("/{order_id}/receipt", response_model=ReceiptOut)
async def get_receipt(
    order_id: int, user: CurrentUserDep, session: SessionDep
) -> ReceiptOut:
    return await PaymentService.receipt(session, order_id, user.id)


@router.post("/{order_id}/reviews", response_model=ReviewOut, status_code=201)
async def create_review(
    order_id: int,
    data: ReviewCreateIn,
    user: CurrentUserDep,
    session: SessionDep,
) -> ReviewOut:
    return await ReviewService.create(session, order_id, user.id, data)
