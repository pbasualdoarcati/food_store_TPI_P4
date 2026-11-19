from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import AfterValidator, EmailStr
from sqlmodel import Field, SQLModel

Rol = Literal["user", "admin"]


def _como_utc(valor: datetime) -> datetime:
    # SQLite devuelve fechas sin zona: se guardaron en UTC, así que se marcan como UTC
    return valor.replace(tzinfo=timezone.utc) if valor.tzinfo is None else valor


FechaUTC = Annotated[datetime, AfterValidator(_como_utc)]


class UserCreate(SQLModel):
    username: str = Field(min_length=3, max_length=50)
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # bcrypt usa hasta 72 bytes


class UserPublic(SQLModel):
    """Salida pública: nunca incluye hashed_password."""

    id: int
    username: str
    full_name: str
    email: str
    role: Rol
    disabled: bool
    created_at: FechaUTC
