from pydantic import BaseModel


class SupportContactOut(BaseModel):
    phone: str
