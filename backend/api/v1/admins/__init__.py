from fastapi import APIRouter, Depends

from core.auth.dependencies import require_roles
from core.enums import UserRole

from .controllers.analytics import router as analytics_controller_router
from .controllers.orders import router as orders_controller_router
from .controllers.users import router as users_controller_router

router = APIRouter(
    prefix="/admins",
    tags=["admins"],
    dependencies=[Depends(require_roles(UserRole.admin))],
)
router.include_router(users_controller_router)
router.include_router(orders_controller_router)
router.include_router(analytics_controller_router)
