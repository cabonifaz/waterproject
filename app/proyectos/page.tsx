// app/proyectos/page.tsx
// Ya no hay lista global de proyectos: se entra por el PI. Se mantiene la
// ruta como redirección para no romper links viejos.

import { redirect } from 'next/navigation';

export default function ProyectosPage() {
  redirect('/pis');
}
