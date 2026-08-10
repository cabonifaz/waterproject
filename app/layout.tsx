// app/layout.tsx
// Layout raíz de la aplicación

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cronograma de Trabajo',
  description: 'Gestión de proyectos: etapas, módulos, épicas e historias de usuario',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}
