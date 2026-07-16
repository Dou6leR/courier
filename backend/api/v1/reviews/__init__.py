from fastapi import APIRouter

from .controllers.reviews import router as reviews_controller_router

router = APIRouter(prefix="/reviews", tags=["reviews"])
router.include_router(reviews_controller_router)
