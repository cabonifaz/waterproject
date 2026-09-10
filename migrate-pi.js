#!/usr/bin/env node

/**
 * migrate-pi.js
 * Migración: "Sprints y Proyectos por PI (Programa Incremental)".
 *
 * Aplica DATABASE_SCHEMA.sql (tablas programas_incrementales / celulas,
 * columnas pi_id / celula_id, SPs sp_crear_pi, sp_generar_sprints por PI,
 * etc.) y hace el backfill de los datos que ya existían:
 *   - crea un "PI 1" y una célula "General" si no hay ninguno
 *   - engancha los sprints y proyectos huérfanos a ese PI / célula
 *   - reaplica el schema para que la FK sprints->PI, que la primera pasada
 *     no puede crear con datos sin pi_id, quede activa
 *
 * Es idempotente: se puede correr las veces que haga falta.
 *
 * Uso (mismas variables de entorno que setup-database.js):
 *   node migrate-pi.js
 * En Railway:
 *   railway run node migrate-pi.js
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

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
    console.error(`Falta la variable de entorno ${nombre}.`);
    process.exit(1);
  }
  return valor;
}

const DB_CONFIG = {
  host: requireEnv('DB_HOST'),
  port: parseInt(requireEnv('DB_PORT')),
  user: requireEnv('DB_USER'),
  password: requireEnv('DB_PASSWORD'),
  database: requireEnv('DB_NAME'),
  multipleStatements: false,
};

const c = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};
const log = {
  info: (m) => console.log(`  ${m}`),
  ok: (m) => console.log(`${c.green}✓ ${m}${c.reset}`),
  warn: (m) => console.log(`${c.yellow}⚠ ${m}${c.reset}`),
  err: (m) => console.log(`${c.red}✗ ${m}${c.reset}`),
  section: (m) => console.log(`\n${c.cyan}━━ ${m} ━━${c.reset}`),
};

// Mismo splitter que setup-database.js (respeta DELIMITER $$).
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
    if (buffer.trim().endsWith(delimiter)) {
      const stmt = buffer.trim().slice(0, -delimiter.length).trim();
      if (stmt.length > 0) statements.push(stmt);
      buffer = '';
    }
  }
  if (buffer.trim().length > 0) statements.push(buffer.trim());
  return statements;
}

async function aplicarSchema(connection, etiqueta) {
  const sql = fs.readFileSync(path.join(__dirname, 'DATABASE_SCHEMA.sql'), 'utf8');
  const statements = splitStatements(sql);
  let fallos = 0;
  for (const stmt of statements) {
    try {
      await connection.query(stmt);
    } catch (err) {
      fallos++;
      // Los "Duplicate column/key", "check that column/key exists" y
      // similares son esperados al reaplicar el schema — no se listan.
      const benigno = /duplicate|check that column|already exists|doesn't exist/i.test(err.message);
      if (!benigno) log.warn(`${etiqueta}: ${err.message.slice(0, 140)}`);
    }
  }
  log.ok(`${etiqueta}: ${statements.length} sentencias (${fallos} con error/benignas)`);
}

async function backfill(connection) {
  const [[{ n: pis }]] = await connection.query('SELECT COUNT(*) n FROM programas_incrementales');
  let piId;
  if (pis === 0) {
    const [[{ minf }]] = await connection.query('SELECT MIN(fecha_inicio) minf FROM sprints');
    const [r] = await connection.query(
      'INSERT INTO programas_incrementales (nombre, fecha_inicio, orden) VALUES (?, ?, 0)',
      ['PI 1', minf || null]
    );
    piId = r.insertId;
    log.ok(`PI 1 creado (id ${piId})`);
  } else {
    const [[{ id }]] = await connection.query(
      'SELECT id FROM programas_incrementales ORDER BY orden, id LIMIT 1'
    );
    piId = id;
    log.info(`PI existente id ${piId} — se usa para el backfill`);
  }

  const [sp] = await connection.query(
    'UPDATE sprints SET pi_id = ? WHERE pi_id IS NULL OR pi_id = 0',
    [piId]
  );
  if (sp.affectedRows) log.ok(`${sp.affectedRows} sprint(s) enganchado(s) al PI ${piId}`);

  const [[{ n: cels }]] = await connection.query('SELECT COUNT(*) n FROM celulas WHERE pi_id = ?', [piId]);
  let celId;
  if (cels === 0) {
    const [r] = await connection.query(
      'INSERT INTO celulas (pi_id, nombre, orden) VALUES (?, ?, 0)',
      [piId, 'General']
    );
    celId = r.insertId;
    log.ok(`Célula "General" creada (id ${celId})`);
  } else {
    const [[{ id }]] = await connection.query(
      'SELECT id FROM celulas WHERE pi_id = ? ORDER BY orden, id LIMIT 1',
      [piId]
    );
    celId = id;
  }

  const [p1] = await connection.query('UPDATE proyectos SET pi_id = ? WHERE pi_id IS NULL', [piId]);
  const [p2] = await connection.query(
    'UPDATE proyectos SET celula_id = ? WHERE pi_id = ? AND celula_id IS NULL',
    [celId, piId]
  );
  if (p1.affectedRows) log.ok(`${p1.affectedRows} proyecto(s) asignado(s) al PI ${piId}`);
  if (p2.affectedRows) log.ok(`${p2.affectedRows} proyecto(s) asignado(s) a la célula "General"`);
}

async function main() {
  log.section(`MIGRACIÓN PI — ${DB_CONFIG.database} @ ${DB_CONFIG.host}:${DB_CONFIG.port}`);
  const connection = await mysql.createConnection(DB_CONFIG);
  try {
    log.section('1/3 · Aplicar schema (pasada 1)');
    await aplicarSchema(connection, 'schema #1');

    log.section('2/3 · Backfill de datos existentes');
    await backfill(connection);

    log.section('3/3 · Reaplicar schema (activa la FK sprints→PI)');
    await aplicarSchema(connection, 'schema #2');

    log.section('VERIFICACIÓN');
    const [proc] = await connection.query(
      "SELECT COUNT(*) n FROM information_schema.routines WHERE routine_schema = ? AND routine_name IN " +
        "('sp_crear_pi','sp_listar_pis','sp_generar_sprints','sp_listar_sprints_proyecto','sp_listar_proyectos_pi')",
      [DB_CONFIG.database]
    );
    log.info(`SPs clave presentes: ${proc[0].n}/5`);
    const [fk] = await connection.query(
      "SELECT constraint_name FROM information_schema.key_column_usage " +
        "WHERE table_schema = ? AND table_name = 'sprints' AND referenced_table_name = 'programas_incrementales'",
      [DB_CONFIG.database]
    );
    if (fk.length) log.ok('FK sprints→programas_incrementales activa');
    else log.warn('FK sprints→PI NO activa (revisá si quedaron sprints sin pi_id)');

    const [[huerf]] = await connection.query(
      'SELECT (SELECT COUNT(*) FROM sprints WHERE pi_id IS NULL OR pi_id = 0) s, ' +
        '(SELECT COUNT(*) FROM proyectos WHERE pi_id IS NULL) p'
    );
    log.info(`Huérfanos restantes — sprints: ${huerf.s}, proyectos: ${huerf.p}`);

    log.section('LISTO');
  } catch (err) {
    log.err(`Error fatal: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();
