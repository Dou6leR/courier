from fastapi import APIRouter

from .admins import router as admins_router
from .auth import router as auth_router
from .couriers import router as couriers_router
from .debug import router as debug_router
from .orders import router as orders_router
from .payments import router as payments_router
from .reviews import router as reviews_router
from .support import router as support_router
from .users import router as users_router

router = APIRouter(prefix="/api/v1")
router.include_router(auth_router)
router.include_router(users_router)
router.include_router(orders_router)
router.include_router(couriers_router)
router.include_router(payments_router)
router.include_router(reviews_router)
router.include_router(admins_router)
router.include_router(support_router)
router.include_router(debug_router)
