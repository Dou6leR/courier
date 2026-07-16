from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.v1.orders.services.order_service import (
    PRICE_BASE,
    PRICE_PER_KG,
    PRICE_PER_M3,
    SERVICE_FEE,
)
from core.debug_clock import now_utc
from core.models.order import Order
from core.models.payment import Payment
from core.schemas.payment import PaymentOut, ReceiptItem, ReceiptOut


class PaymentService:
    @classmethod
    async def _load_order_with_payment(
        cls, session: AsyncSession, order_id: int
    ) -> Order | None:
        stmt = (
            select(Order)
            .where(Order.id == order_id)
            .options(
                selectinload(Order.payment),
                selectinload(Order.cargo),
                selectinload(Order.logistics),
            )
        )
        return await session.scalar(stmt)

    @classmethod
    async def pay(
        cls, session: AsyncSession, order_id: int, user_id: int
    ) -> PaymentOut:
        order = await cls._load_order_with_payment(session, order_id)
        if order is None or order.sender_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )
        payment: Payment | None = order.payment
        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found"
            )
        if payment.paid_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Already paid"
            )
        payment.paid_at = now_utc()
        await session.commit()
        await session.refresh(payment)
        return PaymentOut.model_validate(payment)

    @classmethod
    async def receipt(
        cls, session: AsyncSession, order_id: int, user_id: int,
        *, is_courier: bool = False,
    ) -> ReceiptOut:
        order = await cls._load_order_with_payment(session, order_id)
        allowed_ids = set()
        if order is not None:
            allowed_ids = {order.sender_id, order.recipient_id}
            if order.logistics and order.logistics.courier_id:
                allowed_ids.add(order.logistics.courier_id)
        if order is None or user_id not in allowed_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )
        payment = order.payment
        if payment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found"
            )
        cargo = order.cargo
        weight_cost = round(float(cargo.weight) * PRICE_PER_KG, 2)
        volume_cost = round(float(cargo.volume) * PRICE_PER_M3, 2)
        fee_amount = -SERVICE_FEE if is_courier else SERVICE_FEE
        items = [
            ReceiptItem(label="Базова вартість", amount=PRICE_BASE),
            ReceiptItem(label=f"Вага ({cargo.weight} кг)", amount=weight_cost),
            ReceiptItem(label=f"Об'єм ({cargo.volume} м³)", amount=volume_cost),
            ReceiptItem(label="Сервісний збір", amount=fee_amount),
        ]
        total = float(payment.amount) - SERVICE_FEE if is_courier else float(payment.amount)
        return ReceiptOut(
            order_id=order.id,
            items=items,
            total=round(total, 2),
            method=payment.payment_method,
            paid_at=payment.paid_at,
            issued_at=now_utc(),
        )
