// lib/db.ts
// Configuración de conexión a MySQL usando mysql2/promise
// Todas las operaciones van a través de Stored Procedures

import mysql from 'mysql2/promise';
import { Pool, PoolConnection } from 'mysql2/promise';

let pool: Pool | null = null;

/**
 * Obtener pool de conexiones MySQL
 */
function requireEnv(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre} (configurala en .env.local o en las variables del entorno de despliegue).`);
  }
  return valor;
}

export async function getPool(): Promise<Pool> {
  if (!pool) {
    pool = mysql.createPool({
      host: requireEnv('DB_HOST'),
      port: parseInt(requireEnv('DB_PORT')),
      user: requireEnv('DB_USER'),
      password: requireEnv('DB_PASSWORD'),
      database: requireEnv('DB_NAME'),
      decimalNumbers: true,
      waitForConnections: true,
      connectionLimit: 4,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }
  return pool;
}

export async function getConnection(): Promise<PoolConnection> {
  const pool = await getPool();
  return pool.getConnection();
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Ejecutar un stored procedure
 */
export async function executeProcedure<T = any>(
  procedureName: string,
  params: any[] = []
): Promise<T[]> {
  const connection = await getConnection();
  try {
    const placeholders = params.map(() => '?').join(',');
    const query = `CALL ${procedureName}(${placeholders})`;
    const [results] = await connection.query(query, params);
    return (Array.isArray(results) ? results[0] : results) as T[];
  } catch (error) {
    console.error(`Error ejecutando ${procedureName}:`, error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Ejecutar query raw (cuando no hay SP)
 */
export async function executeQuery<T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  const connection = await getConnection();
  try {
    const [results] = await connection.query(query, params);
    return results as T[];
  } catch (error) {
    console.error('Error ejecutando query:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Health check de la base de datos
 */
export async function healthCheck(): Promise<boolean> {
  let connection: PoolConnection | null = null;
  try {
    connection = await getConnection();
    await connection.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  } finally {
    connection?.release();
  }
}
