interface EstadoErrorProps {
  titulo: string;
  mensaje: string;
  onRetry?: () => void;
}

function EstadoError({ titulo, mensaje, onRetry }: EstadoErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
    >
      <div>
        <p className="font-medium">{titulo}</p>
        <p className="text-sm">{mensaje}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

export default EstadoError;
