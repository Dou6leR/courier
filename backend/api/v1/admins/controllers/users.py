from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.admins.services.admin_user_service import AdminUserService
from core.helpers.db_helper import db_helper
from core.schemas.admin import AdminUserOut, AdminUserStatusIn, UserRoleFilter

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(db_helper.session_getter)]


@router.get("/users", response_model=list[AdminUserOut])
async def list_users(
    session: SessionDep,
    role: UserRoleFilter = "all",
    search: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[AdminUserOut]:
    return await AdminUserService.list_users(
        session, role, search, limit=limit, offset=offset
    )


@router.patch("/users/{user_id}/status", response_model=AdminUserOut)
async def set_user_status(
    user_id: int, data: AdminUserStatusIn, session: SessionDep
) -> AdminUserOut:
    return await AdminUserService.set_active(session, user_id, data.is_active)
