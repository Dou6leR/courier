from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.support.services.support_service import AdminContactService
from core.auth.dependencies import get_current_user
from core.helpers.db_helper import db_helper
from core.models.user import User
from core.schemas.support import SupportContactOut

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(db_helper.session_getter)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]


@router.get("/contact", response_model=SupportContactOut)
async def get_support_contact(
    user: CurrentUserDep, session: SessionDep
) -> SupportContactOut:
    return await AdminContactService.get_contact(session)
