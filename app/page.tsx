// app/page.tsx
// Redirige a la lista de proyectos

import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/proyectos');
}
