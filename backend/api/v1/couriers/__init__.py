from fastapi import APIRouter

from .controllers.couriers import router as couriers_controller_router

router = APIRouter(prefix="/couriers", tags=["couriers"])
router.include_router(couriers_controller_router)
