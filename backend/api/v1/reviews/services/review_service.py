from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.models.enums import OrderStatus
from core.models.order import Order
from core.models.review import Review
from core.schemas.review import ReviewCreateIn, ReviewOut


class ReviewService:
    @classmethod
    async def create(
        cls,
        session: AsyncSession,
        order_id: int,
        user_id: int,
        dto: ReviewCreateIn,
    ) -> ReviewOut:
        stmt = (
            select(Order)
            .where(Order.id == order_id)
            .options(
                selectinload(Order.reviews),
                selectinload(Order.logistics),
            )
        )
        order = await session.scalar(stmt)
        if order is None or user_id not in (order.sender_id, order.recipient_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )
        if order.status != OrderStatus.DELIVERED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Review is allowed only for delivered orders",
            )
        if any(r.author_user_id == user_id for r in order.reviews):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ви вже залишили відгук для цього замовлення",
            )
        review = Review(
            order_id=order.id,
            author_user_id=user_id,
            rating=dto.rating,
            comment=dto.comment,
        )
        session.add(review)
        await session.commit()
        await session.refresh(review)
        return ReviewOut.model_validate(review)
