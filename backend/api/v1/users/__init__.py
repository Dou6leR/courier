from fastapi import APIRouter

from .controllers.users import router as users_controller_router

router = APIRouter(prefix="/users", tags=["users"])
router.include_router(users_controller_router)
