from pydantic import field_validator
from sqlmodel import Field, SQLModel


class CategoriaCreate(SQLModel):
    nombre: str = Field(min_length=2, max_length=100)
    descripcion: str | None = None


class CategoriaUpdate(SQLModel):
    """PUT parcial: solo se modifican los campos enviados."""

    nombre: str | None = Field(default=None, min_length=2, max_length=100)
    descripcion: str | None = None

    @field_validator("nombre")
    @classmethod
    def nombre_no_nulo(cls, v: str | None) -> str:
        # Se puede omitir, pero no mandarlo en null
        if v is None:
            raise ValueError("nombre no puede ser null")
        return v


class CategoriaRead(SQLModel):
    id: int
    nombre: str
    descripcion: str | None
    activo: bool
