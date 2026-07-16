from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.models.admin import Admin
from core.models.user import User
from core.schemas.support import SupportContactOut


class AdminContactService:
    @classmethod
    async def get_contact(cls, session: AsyncSession) -> SupportContactOut:
        stmt = (
            select(User.phone)
            .join(Admin, Admin.user_id == User.id)
            .order_by(Admin.user_id.asc())
            .limit(1)
        )
        phone = (await session.scalars(stmt)).first()
        return SupportContactOut(
            phone=phone if phone is not None else settings.support.admin_phone,
        )
