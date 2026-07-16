from fastapi import APIRouter

from .controllers.auth import router as auth_controller_router

router = APIRouter(prefix="/auth", tags=["auth"])
router.include_router(auth_controller_router)
