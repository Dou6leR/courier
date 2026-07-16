from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReviewCreateIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    author_user_id: int
    rating: int
    comment: str | None
    created_at: datetime
