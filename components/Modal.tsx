// components/Modal.tsx
// Wrapper genérico de modal, mismo look & feel para todos los formularios

'use client';

interface Props {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal = ({ titulo, onClose, children }: Props) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-screen overflow-auto">
        <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">{titulo}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
