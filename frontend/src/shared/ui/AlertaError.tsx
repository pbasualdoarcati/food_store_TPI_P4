interface AlertaErrorProps {
  mensaje: string | null;
}

// Error de una mutación dentro de un formulario o modal
function AlertaError({ mensaje }: AlertaErrorProps) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {mensaje}
    </p>
  );
}

export default AlertaError;
