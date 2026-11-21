import { useEffect, useRef } from 'react';

// Diálogo nativo: gestiona el foco y la tecla Esc por sí mismo (como el Modal del frontend Angular).
export default function Modal({ titulo, abierto, onCerrar, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog ref={ref} onClose={onCerrar} aria-label={titulo}>
      <header className="modal-cab">
        <h2>{titulo}</h2>
        <button type="button" className="btn btn-chico" onClick={onCerrar}>
          Cerrar
        </button>
      </header>
      <div className="modal-cuerpo">{children}</div>
    </dialog>
  );
}
