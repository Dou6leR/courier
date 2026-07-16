from fastapi import APIRouter

from .controllers.payments import router as payments_controller_router

router = APIRouter(prefix="/payments", tags=["payments"])
router.include_router(payments_controller_router)
