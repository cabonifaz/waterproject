// components/Modal.tsx
// Wrapper genérico de modal, mismo look & feel para todos los formularios.
// Se renderiza con un portal directo en <body>: si el modal se abre desde
// dentro de un contenedor con `transform` (ej. el panel fijo del Gantt,
// que se mueve con translateY), `position: fixed` quedaría relativo a ese
// contenedor y el modal aparecería desplazado o recortado.

'use client';

import { createPortal } from 'react-dom';

interface Props {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
  ancho?: string;
}

const Modal = ({ titulo, onClose, children, ancho = 'max-w-lg' }: Props) => {
  const contenido = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg ${ancho} w-full max-h-[calc(100vh-2rem)] overflow-auto`}>
        <div className="sticky top-0 z-10 bg-white border-b p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">{titulo}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );

  // Los modales solo se abren por interacción (ya en el cliente), pero por
  // las dudas se evita el portal si todavía no hay `document`.
  return typeof document === 'undefined' ? contenido : createPortal(contenido, document.body);
};

export default Modal;
