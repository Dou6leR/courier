from fastapi import APIRouter

from .controllers.orders import router as orders_controller_router

router = APIRouter(prefix="/orders", tags=["orders"])
router.include_router(orders_controller_router)
