#!/usr/bin/env node

/**
 * setup-database.js
 * Crea la base de datos y aplica DATABASE_SCHEMA.sql completo.
 * Requiere: node, mysql2
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Carga simple de .env.local (este script corre fuera del runtime de
// Next.js, que es el único que lee .env.local automáticamente).
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  for (const linea of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(linea);
    if (!match) continue;
    const [, clave, valorCrudo] = match;
    if (process.env[clave] === undefined) {
      process.env[clave] = (valorCrudo || '').trim().replace(/^["']|["']$/g, '');
    }
  }
}

function requireEnv(nombre) {
  const valor = process.env[nombre];
  if (!valor) {
    console.error(`Falta la variable de entorno ${nombre} — definila en .env.local o expórtala antes de correr este script.`);
    process.exit(1);
  }
  return valor;
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n${colors.cyan}${msg}${colors.reset}\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`),
};

const DB_CONFIG = {
  host: requireEnv('DB_HOST'),
  port: parseInt(requireEnv('DB_PORT')),
  user: requireEnv('DB_USER'),
  password: requireEnv('DB_PASSWORD'),
};

const DB_NAME = requireEnv('DB_NAME');

/**
 * Divide un script SQL en statements individuales, respetando los
 * bloques `DELIMITER $$ ... $$` usados para definir stored procedures.
 */
function splitStatements(sql) {
  const lines = sql.split('\n');
  let delimiter = ';';
  let buffer = '';
  const statements = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    const delimiterMatch = trimmedLine.match(/^DELIMITER\s+(\S+)$/i);
    if (delimiterMatch) {
      delimiter = delimiterMatch[1];
      continue;
    }

    buffer += line + '\n';
    const trimmedBuffer = buffer.trim();
    if (trimmedBuffer.endsWith(delimiter)) {
      const stmt = trimmedBuffer.slice(0, -delimiter.length).trim();
      if (stmt.length > 0) statements.push(stmt);
      buffer = '';
    }
  }

  const remaining = buffer.trim();
  if (remaining.length > 0) statements.push(remaining);

  return statements;
}

async function executeSqlFile(filePath, connection) {
  log.info(`Leyendo: ${path.basename(filePath)}`);
  const sql = fs.readFileSync(filePath, 'utf8');
  const statements = splitStatements(sql);
  log.info(`Found ${statements.length} statements`);

  for (let i = 0; i < statements.length; i++) {
    try {
      await connection.query(statements[i]);
    } catch (err) {
      log.error(`Statement ${i + 1} falló: ${err.message.substring(0, 120)}`);
    }
  }

  log.success(`✓ ${path.basename(filePath)} ejecutado`);
}

async function main() {
  log.section('🚀 SETUP BASE DE DATOS - CRONOGRAMA');
  log.info(`Host: ${DB_CONFIG.host}:${DB_CONFIG.port}`);
  log.info(`Usuario: ${DB_CONFIG.user}`);
  log.info(`Base de datos: ${DB_NAME}`);

  let connection;
  try {
    log.section('📡 CONEXIÓN A MYSQL');
    connection = await mysql.createConnection({ ...DB_CONFIG });
    log.success('Conectado a MySQL');

    log.section('📊 CREAR BASE DE DATOS');
    await connection.execute(
      `CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    log.success(`Base de datos '${DB_NAME}' creada/verificada`);

    await connection.query(`USE ${DB_NAME}`);

    log.section('🏗️ EJECUTANDO SCHEMA');
    const schemaPath = path.join(__dirname, 'DATABASE_SCHEMA.sql');
    if (!fs.existsSync(schemaPath)) {
      log.error(`Archivo no encontrado: ${schemaPath}`);
      process.exit(1);
    }
    await executeSqlFile(schemaPath, connection);

    log.section('✓ VERIFICACIÓN FINAL');
    const [tables] = await connection.execute(
      `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = '${DB_NAME}'`
    );
    log.success(`Total de tablas creadas: ${tables[0].count}`);
    const [procedures] = await connection.execute(
      `SELECT COUNT(*) as count FROM information_schema.routines WHERE routine_schema = '${DB_NAME}' AND routine_type = 'PROCEDURE'`
    );
    log.success(`Total de Stored Procedures: ${procedures[0].count}`);

    log.section('🎉 ¡SETUP COMPLETADO EXITOSAMENTE!');
    log.info('Próximos pasos: npm install (si falta) y npm run dev');
  } catch (err) {
    log.error(`Error fatal: ${err.message}`);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      log.info('Conexión cerrada');
    }
  }
}

main().catch((err) => {
  log.error(`Error: ${err.message}`);
  process.exit(1);
});
