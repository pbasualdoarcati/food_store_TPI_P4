import { useState } from 'react';

interface ImagenProductoProps {
  url: string | null | undefined;
  nombre: string;
  className?: string;
}

// Si no hay URL o la imagen no carga, muestra un marcador en su lugar
function ImagenProducto({ url, nombre, className = '' }: ImagenProductoProps) {
  const [fallo, setFallo] = useState(false);

  if (!url || fallo) {
    return (
      <div
        aria-hidden="true"
        className={`flex items-center justify-center bg-orange-50 text-3xl ${className}`}
      >
        🍽️
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={nombre}
      loading="lazy"
      onError={() => setFallo(true)}
      className={`object-cover ${className}`}
    />
  );
}

export default ImagenProducto;
