from pydantic import BaseModel, ConfigDict, Field

from core.models.enums import TransportType


class TransportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    model: str
    type: TransportType
    max_weight: float
    max_volume: float


class TransportUpsertIn(BaseModel):
    model: str = Field(min_length=1, max_length=128)
    type: TransportType
    max_weight: float = Field(gt=0)
    max_volume: float = Field(gt=0)
