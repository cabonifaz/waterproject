// app/page.tsx
// Redirige a la lista de Programas Incrementales

import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/pis');
}
