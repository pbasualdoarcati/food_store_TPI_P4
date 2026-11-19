from collections.abc import Callable
from types import TracebackType
from typing import Self

from sqlmodel import Session


class UnitOfWork:
    """Abre la sesión al entrar al `with` y al salir hace commit o rollback.

    Cada módulo hereda y crea en `_init_repositories` los repositorios que
    necesitan sus casos de uso; todos comparten la misma sesión.
    """

    session: Session

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self.session_factory = session_factory

    def _init_repositories(self) -> None:
        pass

    def __enter__(self) -> Self:
        self.session = self.session_factory()
        self._init_repositories()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        # try/finally: la sesión se cierra aunque el commit falle.
        # No devuelve True, así la excepción original llega al Router.
        try:
            if exc_type:
                self.session.rollback()
            else:
                self.session.commit()
        finally:
            self.session.close()
