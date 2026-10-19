from pydantic import BaseModel


class AiModelItem(BaseModel):
    code: str
    display_name: str
    provider: str
    color: str
    is_active: bool

    model_config = {"from_attributes": True}
