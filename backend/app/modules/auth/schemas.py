from sqlmodel import SQLModel

# UserCreate y UserPublic viven en el módulo usuarios (dueño del modelo Usuario)
from app.modules.usuarios.schemas import UserCreate, UserPublic

__all__ = ["MensajeRespuesta", "UserCreate", "UserPublic"]


class MensajeRespuesta(SQLModel):
    message: str
