from fastapi import APIRouter

from .controllers.support import router as support_controller_router

router = APIRouter(prefix="/support", tags=["support"])
router.include_router(support_controller_router)
