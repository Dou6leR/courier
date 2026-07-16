from fastapi import APIRouter

from .controllers.clock import router as clock_router

router = APIRouter(prefix="/debug", tags=["debug"])
router.include_router(clock_router)
