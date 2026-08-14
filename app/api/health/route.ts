// app/api/health/route.ts

import { NextResponse } from 'next/server';
import { healthCheck } from '@/lib/db';

// Sin esto, Next.js puede prerenderizar esta ruta como estática en el
// build (no lee nada del request) y servir siempre la misma respuesta
// congelada — inútil como health check en vivo.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ok = await healthCheck();
    return NextResponse.json(
      {
        status: ok ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
        database: ok ? 'connected' : 'disconnected',
        uptime: process.uptime(),
      },
      { status: ok ? 200 : 503 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'unknown' },
      { status: 503 }
    );
  }
}
