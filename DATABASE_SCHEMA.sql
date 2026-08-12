-- ========================================
-- CRONOGRAMA DE TRABAJO - SCHEMA
-- Proyecto -> Etapa -> (Modulo -> Epica -> Historia de Usuario) | Tarea Matriz
-- Database: MySQL 8.0+
-- ========================================

-- ========================================
-- 1. TABLAS
-- ========================================

-- estado_planificacion: 'abierto' = se puede marcar/editar el Gantt
-- planificado libremente. 'cerrado' = quedó congelado (sp_marcar_dia_hu y
-- sp_marcar_dia_tarea_matriz rechazan cambios); hay que "reactivar" (entra
-- en Control de Cambios) para volver a editarlo. baseline_capturado marca
-- si ya se guardó una copia congelada del planificado inicial — se hace
-- una sola vez, en el primer cierre, y nunca se vuelve a pisar aunque se
-- reactive/cierre de nuevo más adelante.
CREATE TABLE IF NOT EXISTS proyectos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion LONGTEXT,
  fecha_inicio DATE NOT NULL,
  estado ENUM('activo', 'pausado', 'completado', 'cancelado') DEFAULT 'activo',
  estado_planificacion ENUM('abierto', 'cerrado') NOT NULL DEFAULT 'abierto',
  baseline_capturado BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE proyectos ADD COLUMN estado_planificacion ENUM('abierto', 'cerrado') NOT NULL DEFAULT 'abierto' AFTER estado;
ALTER TABLE proyectos ADD COLUMN baseline_capturado BOOLEAN NOT NULL DEFAULT FALSE AFTER estado_planificacion;

-- tipo='desarrollo': la única etapa del proyecto que puede tener módulos
-- (-> épicas -> HU). tipo='simple': el resto de las etapas, que solo
-- pueden tener tareas matrices directas.
CREATE TABLE IF NOT EXISTS etapas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proyecto_id INT NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  tipo ENUM('desarrollo', 'simple') NOT NULL DEFAULT 'simple',
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
  UNIQUE KEY uq_proyecto_etapa (proyecto_id, nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ALTER simple (sin IF NOT EXISTS: no soportado para ADD COLUMN en esta
-- versión/combinación); en una reinstalación limpia la tabla ya nace con
-- la columna vía el CREATE TABLE de arriba y este ALTER falla con "columna
-- duplicada", error que el script de setup ya tolera y sigue de largo.
ALTER TABLE etapas ADD COLUMN tipo ENUM('desarrollo', 'simple') NOT NULL DEFAULT 'simple' AFTER nombre;

CREATE TABLE IF NOT EXISTS modulos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  etapa_id INT NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (etapa_id) REFERENCES etapas(id) ON DELETE CASCADE,
  UNIQUE KEY uq_etapa_modulo (etapa_id, nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS epicas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  modulo_id INT NOT NULL,
  nombre VARCHAR(500) NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE CASCADE,
  UNIQUE KEY uq_modulo_epica (modulo_id, nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS historias_usuario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  epica_id INT NOT NULL,
  codigo VARCHAR(50),
  titulo VARCHAR(500) NOT NULL,
  descripcion LONGTEXT,
  responsable VARCHAR(255),
  prioridad ENUM('baja', 'media', 'alta') DEFAULT 'media',
  dias_desarrollo INT NOT NULL DEFAULT 0,
  dias_certificacion INT NOT NULL DEFAULT 0,
  cerrada BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_cierre DATE,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (epica_id) REFERENCES epicas(id) ON DELETE CASCADE,
  INDEX idx_hu_epica (epica_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tareas_matrices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  etapa_id INT NOT NULL,
  titulo VARCHAR(500) NOT NULL,
  descripcion LONGTEXT,
  responsable VARCHAR(255),
  dias_estimados INT NOT NULL DEFAULT 0,
  completada BOOLEAN NOT NULL DEFAULT FALSE,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (etapa_id) REFERENCES etapas(id) ON DELETE CASCADE,
  INDEX idx_tareamatriz_etapa (etapa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Plantilla global de sprints: NO pertenecen a un proyecto — es una única
-- línea de tiempo compartida por todos los proyectos (misma calendarización
-- de sprints para toda la organización).
CREATE TABLE IF NOT EXISTS sprints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero INT NOT NULL UNIQUE,
  tipo ENUM('priorizacion','sprint') NOT NULL DEFAULT 'sprint',
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migración de columna sobre tabla ya existente (CREATE TABLE IF NOT EXISTS
-- no la agrega si la tabla ya estaba creada); "Duplicate column" en un
-- re-run es esperado e inofensivo.
ALTER TABLE sprints ADD COLUMN tipo ENUM('priorizacion','sprint') NOT NULL DEFAULT 'sprint' AFTER numero;

-- Feriados globales: se muestran resaltados en todas las filas del Gantt
-- (no se excluyen como los fines de semana) para que se note que ese día
-- no es hábil sin perder la columna de referencia.
CREATE TABLE IF NOT EXISTS feriados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Marcado planificado día por día en el Gantt. Una fila por celda marcada
-- (fecha + tipo de marca) — no un rango contiguo, porque el trabajo real
-- puede saltar días (ej. desarrollo lunes/martes, salto miércoles, jueves).
CREATE TABLE IF NOT EXISTS hu_dias_planificados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  historia_usuario_id INT NOT NULL,
  fecha DATE NOT NULL,
  tipo_marca ENUM('desarrollo', 'certificacion', 'cierre') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (historia_usuario_id) REFERENCES historias_usuario(id) ON DELETE CASCADE,
  UNIQUE KEY uq_hu_fecha (historia_usuario_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tarea_matriz_dias_planificados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tarea_matriz_id INT NOT NULL,
  fecha DATE NOT NULL,
  tipo_marca ENUM('trabajo', 'cierre') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tarea_matriz_id) REFERENCES tareas_matrices(id) ON DELETE CASCADE,
  UNIQUE KEY uq_tm_fecha (tarea_matriz_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Personas del equipo del proyecto (no globales — cada proyecto arma su
-- propia lista) con sus iniciales para mostrar en la columna "Miembros"
-- del Gantt/estructura, ej. "LR", "HB".
CREATE TABLE IF NOT EXISTS miembros_proyecto (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proyecto_id INT NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  iniciales VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
  UNIQUE KEY uq_proyecto_iniciales (proyecto_id, iniciales)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Asignación de miembros a actividades: N:M (una HU/tarea matriz puede
-- tener varios miembros, ej. "LR/HB").
CREATE TABLE IF NOT EXISTS hu_miembros (
  historia_usuario_id INT NOT NULL,
  miembro_id INT NOT NULL,
  PRIMARY KEY (historia_usuario_id, miembro_id),
  FOREIGN KEY (historia_usuario_id) REFERENCES historias_usuario(id) ON DELETE CASCADE,
  FOREIGN KEY (miembro_id) REFERENCES miembros_proyecto(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tarea_matriz_miembros (
  tarea_matriz_id INT NOT NULL,
  miembro_id INT NOT NULL,
  PRIMARY KEY (tarea_matriz_id, miembro_id),
  FOREIGN KEY (tarea_matriz_id) REFERENCES tareas_matrices(id) ON DELETE CASCADE,
  FOREIGN KEY (miembro_id) REFERENCES miembros_proyecto(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copia congelada del planificado tal cual estaba en el primer cierre
-- ("Cerrar Planificado"). No se vuelve a tocar nunca más — sirve de
-- referencia fija para comparar contra las re-planificaciones (Control de
-- Cambios) y, más adelante, contra el Gantt real.
CREATE TABLE IF NOT EXISTS hu_dias_planificados_baseline (
  id INT AUTO_INCREMENT PRIMARY KEY,
  historia_usuario_id INT NOT NULL,
  fecha DATE NOT NULL,
  tipo_marca ENUM('desarrollo', 'certificacion', 'cierre') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (historia_usuario_id) REFERENCES historias_usuario(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tarea_matriz_dias_planificados_baseline (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tarea_matriz_id INT NOT NULL,
  fecha DATE NOT NULL,
  tipo_marca ENUM('trabajo', 'cierre') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tarea_matriz_id) REFERENCES tareas_matrices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Marcado del Gantt REAL: mismo mecanismo día a día que el planificado,
-- pero en tablas separadas — nunca se mezclan. Solo se puede escribir acá
-- cuando el proyecto tiene el planificado 'cerrado' (ver sp_marcar_dia_hu_real
-- / sp_marcar_dia_tarea_matriz_real).
CREATE TABLE IF NOT EXISTS hu_dias_reales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  historia_usuario_id INT NOT NULL,
  fecha DATE NOT NULL,
  tipo_marca ENUM('desarrollo', 'certificacion', 'cierre') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (historia_usuario_id) REFERENCES historias_usuario(id) ON DELETE CASCADE,
  UNIQUE KEY uq_hu_real_fecha (historia_usuario_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tarea_matriz_dias_reales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tarea_matriz_id INT NOT NULL,
  fecha DATE NOT NULL,
  tipo_marca ENUM('trabajo', 'cierre') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tarea_matriz_id) REFERENCES tareas_matrices(id) ON DELETE CASCADE,
  UNIQUE KEY uq_tm_real_fecha (tarea_matriz_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- "Avance Célula": reporte real vs. planificado (vs. baseline), generado a
-- pedido. La vista en vivo se recalcula siempre desde los datos actuales;
-- recién queda guardada como histórico ("foto") cuando el usuario confirma
-- el cierre del corte — así se puede comparar cuánto avanzó desde el corte
-- anterior. Un corte por proyecto y fecha: si se vuelve a cerrar el mismo
-- día, se actualiza (no se duplica).
CREATE TABLE IF NOT EXISTS cortes_avance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proyecto_id INT NOT NULL,
  fecha_corte DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
  UNIQUE KEY uq_proyecto_fecha_corte (proyecto_id, fecha_corte)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Una fila por etapa/épica/tarea matriz mostrada en el reporte, con los
-- tres conteos de días que ya se ven en el Gantt: baseline (Días
-- Totales), planificado actual y real a la fecha del corte.
CREATE TABLE IF NOT EXISTS cortes_avance_detalle (
  id INT AUTO_INCREMENT PRIMARY KEY,
  corte_id INT NOT NULL,
  tipo ENUM('etapa', 'epica', 'tarea_matriz') NOT NULL,
  referencia_id INT NOT NULL,
  etapa_nombre VARCHAR(255) NOT NULL,
  nombre VARCHAR(500) NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  dias_totales INT NOT NULL DEFAULT 0,
  dias_planificados INT NOT NULL DEFAULT 0,
  dias_reales INT NOT NULL DEFAULT 0,
  FOREIGN KEY (corte_id) REFERENCES cortes_avance(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 2. STORED PROCEDURES: PROYECTOS
-- ========================================

DROP PROCEDURE IF EXISTS sp_crear_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_crear_proyecto (
  IN p_nombre VARCHAR(255),
  IN p_descripcion LONGTEXT,
  IN p_fecha_inicio DATE
)
BEGIN
  INSERT INTO proyectos (nombre, descripcion, fecha_inicio)
  VALUES (p_nombre, p_descripcion, p_fecha_inicio);
  SELECT LAST_INSERT_ID() AS id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_proyectos;
DELIMITER $$
CREATE PROCEDURE sp_listar_proyectos ()
BEGIN
  SELECT * FROM proyectos ORDER BY created_at DESC;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_obtener_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_obtener_proyecto (
  IN p_id INT
)
BEGIN
  SELECT * FROM proyectos WHERE id = p_id;
END$$
DELIMITER ;

-- Cierra el planificado: sp_marcar_dia_hu / sp_marcar_dia_tarea_matriz
-- van a rechazar cualquier cambio mientras esté 'cerrado'. La PRIMERA vez
-- que se cierra un proyecto, además se copia todo lo marcado hasta ese
-- momento a las tablas *_baseline — esa copia es "el planificado inicial"
-- y no se vuelve a tocar en cierres posteriores (baseline_capturado ya
-- queda en TRUE para siempre).
DROP PROCEDURE IF EXISTS sp_cerrar_planificado;
DELIMITER $$
CREATE PROCEDURE sp_cerrar_planificado (
  IN p_proyecto_id INT
)
BEGIN
  DECLARE v_baseline_capturado BOOLEAN DEFAULT FALSE;

  SELECT baseline_capturado INTO v_baseline_capturado FROM proyectos WHERE id = p_proyecto_id;

  IF NOT v_baseline_capturado THEN
    INSERT INTO hu_dias_planificados_baseline (historia_usuario_id, fecha, tipo_marca)
    SELECT d.historia_usuario_id, d.fecha, d.tipo_marca
    FROM hu_dias_planificados d
    JOIN historias_usuario h ON d.historia_usuario_id = h.id
    JOIN epicas e ON h.epica_id = e.id
    JOIN modulos m ON e.modulo_id = m.id
    JOIN etapas et ON m.etapa_id = et.id
    WHERE et.proyecto_id = p_proyecto_id;

    INSERT INTO tarea_matriz_dias_planificados_baseline (tarea_matriz_id, fecha, tipo_marca)
    SELECT d.tarea_matriz_id, d.fecha, d.tipo_marca
    FROM tarea_matriz_dias_planificados d
    JOIN tareas_matrices t ON d.tarea_matriz_id = t.id
    JOIN etapas et ON t.etapa_id = et.id
    WHERE et.proyecto_id = p_proyecto_id;

    UPDATE proyectos SET baseline_capturado = TRUE WHERE id = p_proyecto_id;
  END IF;

  UPDATE proyectos SET estado_planificacion = 'cerrado' WHERE id = p_proyecto_id;
  SELECT * FROM proyectos WHERE id = p_proyecto_id;
END$$
DELIMITER ;

-- Reactiva el planificado para poder seguir editándolo (Control de
-- Cambios / re-planificación). No toca el baseline.
DROP PROCEDURE IF EXISTS sp_reactivar_planificado;
DELIMITER $$
CREATE PROCEDURE sp_reactivar_planificado (
  IN p_proyecto_id INT
)
BEGIN
  UPDATE proyectos SET estado_planificacion = 'abierto' WHERE id = p_proyecto_id;
  SELECT * FROM proyectos WHERE id = p_proyecto_id;
END$$
DELIMITER ;

-- Elimina el proyecto completo. Todo lo que cuelga de él (etapas, módulos,
-- épicas, HU, tareas matrices, y los días planificados de cada una) se
-- borra en cascada por las FK ON DELETE CASCADE — no hace falta borrarlo a
-- mano tabla por tabla. Los sprints y feriados NO se tocan: son globales,
-- compartidos con el resto de los proyectos.
DROP PROCEDURE IF EXISTS sp_eliminar_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_eliminar_proyecto (
  IN p_id INT
)
BEGIN
  DELETE FROM proyectos WHERE id = p_id;
END$$
DELIMITER ;

-- ========================================
-- 3. STORED PROCEDURES: ETAPAS
-- ========================================

DROP PROCEDURE IF EXISTS sp_crear_etapa;
DELIMITER $$
CREATE PROCEDURE sp_crear_etapa (
  IN p_proyecto_id INT,
  IN p_nombre VARCHAR(255),
  IN p_tipo VARCHAR(20),
  IN p_orden INT
)
BEGIN
  DECLARE v_ya_existe INT DEFAULT 0;

  IF COALESCE(p_tipo, 'simple') = 'desarrollo' THEN
    SELECT COUNT(*) INTO v_ya_existe FROM etapas WHERE proyecto_id = p_proyecto_id AND tipo = 'desarrollo';
    IF v_ya_existe > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ya existe una etapa de Desarrollo en este proyecto';
    END IF;
  END IF;

  INSERT INTO etapas (proyecto_id, nombre, tipo, orden)
  VALUES (p_proyecto_id, p_nombre, COALESCE(p_tipo, 'simple'), COALESCE(p_orden, 0));
  SELECT LAST_INSERT_ID() AS id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_etapas_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_listar_etapas_proyecto (
  IN p_proyecto_id INT
)
BEGIN
  SELECT * FROM etapas WHERE proyecto_id = p_proyecto_id ORDER BY orden, id;
END$$
DELIMITER ;

-- ========================================
-- 4. STORED PROCEDURES: MODULOS
-- ========================================

DROP PROCEDURE IF EXISTS sp_crear_modulo;
DELIMITER $$
CREATE PROCEDURE sp_crear_modulo (
  IN p_etapa_id INT,
  IN p_nombre VARCHAR(255),
  IN p_orden INT
)
BEGIN
  DECLARE v_tipo_etapa VARCHAR(20);

  SELECT tipo INTO v_tipo_etapa FROM etapas WHERE id = p_etapa_id;
  IF v_tipo_etapa IS NULL OR v_tipo_etapa != 'desarrollo' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los módulos solo se pueden agregar a la etapa de Desarrollo';
  END IF;

  INSERT INTO modulos (etapa_id, nombre, orden)
  VALUES (p_etapa_id, p_nombre, COALESCE(p_orden, 0));
  SELECT LAST_INSERT_ID() AS id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_modulos_etapa;
DELIMITER $$
CREATE PROCEDURE sp_listar_modulos_etapa (
  IN p_etapa_id INT
)
BEGIN
  SELECT * FROM modulos WHERE etapa_id = p_etapa_id ORDER BY orden, id;
END$$
DELIMITER ;

-- ========================================
-- 5. STORED PROCEDURES: EPICAS
-- ========================================

DROP PROCEDURE IF EXISTS sp_crear_epica;
DELIMITER $$
CREATE PROCEDURE sp_crear_epica (
  IN p_modulo_id INT,
  IN p_nombre VARCHAR(500),
  IN p_orden INT
)
BEGIN
  INSERT INTO epicas (modulo_id, nombre, orden)
  VALUES (p_modulo_id, p_nombre, COALESCE(p_orden, 0));
  SELECT LAST_INSERT_ID() AS id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_epicas_modulo;
DELIMITER $$
CREATE PROCEDURE sp_listar_epicas_modulo (
  IN p_modulo_id INT
)
BEGIN
  SELECT * FROM epicas WHERE modulo_id = p_modulo_id ORDER BY orden, id;
END$$
DELIMITER ;

-- ========================================
-- 6. STORED PROCEDURES: HISTORIAS DE USUARIO
-- ========================================

DROP PROCEDURE IF EXISTS sp_crear_historia_usuario;
DELIMITER $$
CREATE PROCEDURE sp_crear_historia_usuario (
  IN p_epica_id INT,
  IN p_codigo VARCHAR(50),
  IN p_titulo VARCHAR(500),
  IN p_descripcion LONGTEXT,
  IN p_responsable VARCHAR(255),
  IN p_prioridad VARCHAR(20),
  IN p_dias_desarrollo INT,
  IN p_dias_certificacion INT,
  IN p_orden INT
)
BEGIN
  INSERT INTO historias_usuario (
    epica_id, codigo, titulo, descripcion, responsable, prioridad,
    dias_desarrollo, dias_certificacion, orden
  ) VALUES (
    p_epica_id, p_codigo, p_titulo, p_descripcion, p_responsable,
    COALESCE(p_prioridad, 'media'), COALESCE(p_dias_desarrollo, 0),
    COALESCE(p_dias_certificacion, 0), COALESCE(p_orden, 0)
  );
  SELECT LAST_INSERT_ID() AS id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_hu_epica;
DELIMITER $$
CREATE PROCEDURE sp_listar_hu_epica (
  IN p_epica_id INT
)
BEGIN
  SELECT * FROM historias_usuario WHERE epica_id = p_epica_id ORDER BY orden, id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_cerrar_historia_usuario;
DELIMITER $$
CREATE PROCEDURE sp_cerrar_historia_usuario (
  IN p_id INT
)
BEGIN
  UPDATE historias_usuario
  SET cerrada = TRUE, fecha_cierre = CURDATE()
  WHERE id = p_id;
  SELECT * FROM historias_usuario WHERE id = p_id;
END$$
DELIMITER ;

-- ========================================
-- 7. STORED PROCEDURES: TAREAS MATRICES
-- ========================================

DROP PROCEDURE IF EXISTS sp_crear_tarea_matriz;
DELIMITER $$
CREATE PROCEDURE sp_crear_tarea_matriz (
  IN p_etapa_id INT,
  IN p_titulo VARCHAR(500),
  IN p_descripcion LONGTEXT,
  IN p_responsable VARCHAR(255),
  IN p_dias_estimados INT,
  IN p_orden INT
)
BEGIN
  DECLARE v_tipo_etapa VARCHAR(20);

  SELECT tipo INTO v_tipo_etapa FROM etapas WHERE id = p_etapa_id;
  IF v_tipo_etapa = 'desarrollo' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las tareas matrices no se pueden agregar a la etapa de Desarrollo';
  END IF;

  INSERT INTO tareas_matrices (etapa_id, titulo, descripcion, responsable, dias_estimados, orden)
  VALUES (p_etapa_id, p_titulo, p_descripcion, p_responsable, COALESCE(p_dias_estimados, 0), COALESCE(p_orden, 0));
  SELECT LAST_INSERT_ID() AS id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_tareas_matrices_etapa;
DELIMITER $$
CREATE PROCEDURE sp_listar_tareas_matrices_etapa (
  IN p_etapa_id INT
)
BEGIN
  SELECT * FROM tareas_matrices WHERE etapa_id = p_etapa_id ORDER BY orden, id;
END$$
DELIMITER ;

-- ========================================
-- 8. STORED PROCEDURES: SPRINTS (plantilla global)
-- ========================================
-- Se generan en lote: fecha de inicio + duración en días + cantidad ->
-- arma N sprints consecutivos sin superponerse, compartidos por todos los
-- proyectos. Si ya hay sprints cargados, sigue numerando a partir del
-- último. La primera vez que se genera (todavía no hay ningún sprint),
-- si se pide una "Priorización" (p_dias_priorizacion > 0) se crea un
-- período previo al Sprint 1 (numero=0, tipo='priorizacion') — es la
-- "Zona Gris" que se ve en el Gantt antes de la línea de sprints. Se
-- crea una única vez: si ya existe, se ignora p_dias_priorizacion.

DROP PROCEDURE IF EXISTS sp_generar_sprints;
DELIMITER $$
CREATE PROCEDURE sp_generar_sprints (
  IN p_fecha_inicio DATE,
  IN p_dias_duracion INT,
  IN p_cantidad INT,
  IN p_dias_priorizacion INT
)
BEGIN
  DECLARE v_numero INT;
  DECLARE v_max_numero INT;
  DECLARE v_fecha_inicio DATE;
  DECLARE v_fecha_fin DATE;
  DECLARE v_existe_priorizacion INT DEFAULT 0;

  SET v_fecha_inicio = p_fecha_inicio;

  SELECT COUNT(*) INTO v_existe_priorizacion FROM sprints WHERE tipo = 'priorizacion';

  IF v_existe_priorizacion = 0 AND p_dias_priorizacion > 0 THEN
    SET v_fecha_fin = DATE_ADD(v_fecha_inicio, INTERVAL (p_dias_priorizacion - 1) DAY);

    INSERT INTO sprints (numero, tipo, fecha_inicio, fecha_fin)
    VALUES (0, 'priorizacion', v_fecha_inicio, v_fecha_fin);

    SET v_fecha_inicio = DATE_ADD(v_fecha_fin, INTERVAL 1 DAY);
  END IF;

  SELECT COALESCE(MAX(numero), 0) INTO v_max_numero FROM sprints WHERE tipo = 'sprint';

  SET v_numero = v_max_numero + 1;

  WHILE v_numero <= v_max_numero + p_cantidad DO
    SET v_fecha_fin = DATE_ADD(v_fecha_inicio, INTERVAL (p_dias_duracion - 1) DAY);

    INSERT INTO sprints (numero, tipo, fecha_inicio, fecha_fin)
    VALUES (v_numero, 'sprint', v_fecha_inicio, v_fecha_fin);

    SET v_fecha_inicio = DATE_ADD(v_fecha_fin, INTERVAL 1 DAY);
    SET v_numero = v_numero + 1;
  END WHILE;

  SELECT * FROM sprints ORDER BY numero;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_sprints;
DELIMITER $$
CREATE PROCEDURE sp_listar_sprints ()
BEGIN
  SELECT * FROM sprints ORDER BY numero;
END$$
DELIMITER ;

-- ========================================
-- 9. STORED PROCEDURES: FERIADOS (globales)
-- ========================================
-- Click en un día del calendario: si ya era feriado, se borra (toggle);
-- si no, se marca.

DROP PROCEDURE IF EXISTS sp_marcar_feriado;
DELIMITER $$
CREATE PROCEDURE sp_marcar_feriado (
  IN p_fecha DATE
)
BEGIN
  DECLARE v_existe INT DEFAULT 0;

  SELECT COUNT(*) INTO v_existe FROM feriados WHERE fecha = p_fecha;

  IF v_existe > 0 THEN
    DELETE FROM feriados WHERE fecha = p_fecha;
  ELSE
    INSERT INTO feriados (fecha) VALUES (p_fecha);
  END IF;

  SELECT * FROM feriados ORDER BY fecha;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_feriados;
DELIMITER $$
CREATE PROCEDURE sp_listar_feriados ()
BEGIN
  SELECT * FROM feriados ORDER BY fecha;
END$$
DELIMITER ;

-- ========================================
-- 10. STORED PROCEDURES: DÍAS PLANIFICADOS (marcado del Gantt)
-- ========================================
-- Click en una celda: si ya estaba marcada con el mismo tipo, se borra
-- (toggle). Si estaba marcada con otro tipo, se reemplaza. "cierre" es
-- único por actividad (marcar uno nuevo mueve el anterior) y siempre debe
-- quedar como el último día de la actividad: no se puede cerrar si hay
-- días de trabajo más adelante, ni agregar días de trabajo después de un
-- cierre ya puesto. Además, con el planificado 'cerrado' no se puede
-- marcar nada — hay que reactivarlo primero (Control de Cambios).

DROP PROCEDURE IF EXISTS sp_marcar_dia_hu;
DELIMITER $$
CREATE PROCEDURE sp_marcar_dia_hu (
  IN p_historia_usuario_id INT,
  IN p_fecha DATE,
  IN p_tipo_marca VARCHAR(20)
)
BEGIN
  DECLARE v_existe_mismo_tipo INT DEFAULT 0;
  DECLARE v_estado_planificacion VARCHAR(20);
  DECLARE v_max_fecha_trabajo DATE;
  DECLARE v_fecha_cierre_actual DATE;

  SELECT p.estado_planificacion INTO v_estado_planificacion
  FROM historias_usuario h
  JOIN epicas e ON h.epica_id = e.id
  JOIN modulos m ON e.modulo_id = m.id
  JOIN etapas et ON m.etapa_id = et.id
  JOIN proyectos p ON et.proyecto_id = p.id
  WHERE h.id = p_historia_usuario_id;

  IF v_estado_planificacion = 'cerrado' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El planificado está cerrado. Reactivalo (Control de Cambios) para hacer cambios.';
  END IF;

  SELECT COUNT(*) INTO v_existe_mismo_tipo
  FROM hu_dias_planificados
  WHERE historia_usuario_id = p_historia_usuario_id AND fecha = p_fecha AND tipo_marca = p_tipo_marca;

  IF v_existe_mismo_tipo > 0 THEN
    DELETE FROM hu_dias_planificados
    WHERE historia_usuario_id = p_historia_usuario_id AND fecha = p_fecha;
  ELSE
    IF p_tipo_marca = 'cierre' THEN
      SELECT MAX(fecha) INTO v_max_fecha_trabajo
      FROM hu_dias_planificados
      WHERE historia_usuario_id = p_historia_usuario_id AND tipo_marca <> 'cierre';

      IF v_max_fecha_trabajo IS NOT NULL AND v_max_fecha_trabajo > p_fecha THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cierre debe quedar en el último día planificado de la actividad.';
      END IF;

      DELETE FROM hu_dias_planificados
      WHERE historia_usuario_id = p_historia_usuario_id AND tipo_marca = 'cierre';
    ELSE
      SELECT fecha INTO v_fecha_cierre_actual
      FROM hu_dias_planificados
      WHERE historia_usuario_id = p_historia_usuario_id AND tipo_marca = 'cierre'
      LIMIT 1;

      IF v_fecha_cierre_actual IS NOT NULL AND p_fecha > v_fecha_cierre_actual THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden marcar días después del cierre de la actividad.';
      END IF;
    END IF;

    DELETE FROM hu_dias_planificados
    WHERE historia_usuario_id = p_historia_usuario_id AND fecha = p_fecha;
    INSERT INTO hu_dias_planificados (historia_usuario_id, fecha, tipo_marca)
    VALUES (p_historia_usuario_id, p_fecha, p_tipo_marca);
  END IF;

  SELECT * FROM hu_dias_planificados WHERE historia_usuario_id = p_historia_usuario_id ORDER BY fecha;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_marcar_dia_tarea_matriz;
DELIMITER $$
CREATE PROCEDURE sp_marcar_dia_tarea_matriz (
  IN p_tarea_matriz_id INT,
  IN p_fecha DATE,
  IN p_tipo_marca VARCHAR(20)
)
BEGIN
  DECLARE v_existe_mismo_tipo INT DEFAULT 0;
  DECLARE v_estado_planificacion VARCHAR(20);
  DECLARE v_max_fecha_trabajo DATE;
  DECLARE v_fecha_cierre_actual DATE;

  SELECT p.estado_planificacion INTO v_estado_planificacion
  FROM tareas_matrices t
  JOIN etapas et ON t.etapa_id = et.id
  JOIN proyectos p ON et.proyecto_id = p.id
  WHERE t.id = p_tarea_matriz_id;

  IF v_estado_planificacion = 'cerrado' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El planificado está cerrado. Reactivalo (Control de Cambios) para hacer cambios.';
  END IF;

  SELECT COUNT(*) INTO v_existe_mismo_tipo
  FROM tarea_matriz_dias_planificados
  WHERE tarea_matriz_id = p_tarea_matriz_id AND fecha = p_fecha AND tipo_marca = p_tipo_marca;

  IF v_existe_mismo_tipo > 0 THEN
    DELETE FROM tarea_matriz_dias_planificados
    WHERE tarea_matriz_id = p_tarea_matriz_id AND fecha = p_fecha;
  ELSE
    IF p_tipo_marca = 'cierre' THEN
      SELECT MAX(fecha) INTO v_max_fecha_trabajo
      FROM tarea_matriz_dias_planificados
      WHERE tarea_matriz_id = p_tarea_matriz_id AND tipo_marca <> 'cierre';

      IF v_max_fecha_trabajo IS NOT NULL AND v_max_fecha_trabajo > p_fecha THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cierre debe quedar en el último día planificado de la actividad.';
      END IF;

      DELETE FROM tarea_matriz_dias_planificados
      WHERE tarea_matriz_id = p_tarea_matriz_id AND tipo_marca = 'cierre';
    ELSE
      SELECT fecha INTO v_fecha_cierre_actual
      FROM tarea_matriz_dias_planificados
      WHERE tarea_matriz_id = p_tarea_matriz_id AND tipo_marca = 'cierre'
      LIMIT 1;

      IF v_fecha_cierre_actual IS NOT NULL AND p_fecha > v_fecha_cierre_actual THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden marcar días después del cierre de la actividad.';
      END IF;
    END IF;

    DELETE FROM tarea_matriz_dias_planificados
    WHERE tarea_matriz_id = p_tarea_matriz_id AND fecha = p_fecha;
    INSERT INTO tarea_matriz_dias_planificados (tarea_matriz_id, fecha, tipo_marca)
    VALUES (p_tarea_matriz_id, p_fecha, p_tipo_marca);
  END IF;

  SELECT * FROM tarea_matriz_dias_planificados WHERE tarea_matriz_id = p_tarea_matriz_id ORDER BY fecha;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_dias_hu_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_listar_dias_hu_proyecto (
  IN p_proyecto_id INT
)
BEGIN
  SELECT d.historia_usuario_id, d.fecha, d.tipo_marca
  FROM hu_dias_planificados d
  JOIN historias_usuario h ON d.historia_usuario_id = h.id
  JOIN epicas e ON h.epica_id = e.id
  JOIN modulos m ON e.modulo_id = m.id
  JOIN etapas et ON m.etapa_id = et.id
  WHERE et.proyecto_id = p_proyecto_id
  ORDER BY d.fecha;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_dias_tarea_matriz_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_listar_dias_tarea_matriz_proyecto (
  IN p_proyecto_id INT
)
BEGIN
  SELECT d.tarea_matriz_id, d.fecha, d.tipo_marca
  FROM tarea_matriz_dias_planificados d
  JOIN tareas_matrices t ON d.tarea_matriz_id = t.id
  JOIN etapas et ON t.etapa_id = et.id
  WHERE et.proyecto_id = p_proyecto_id
  ORDER BY d.fecha;
END$$
DELIMITER ;

-- ========================================
-- 11. STORED PROCEDURES: MIEMBROS DEL PROYECTO
-- ========================================
-- Lista de personas por proyecto (nombre + iniciales) y su asignación
-- N:M a HU/tareas matrices. Asignar/desasignar es un toggle, igual que
-- el marcado de días y feriados.

DROP PROCEDURE IF EXISTS sp_crear_miembro;
DELIMITER $$
CREATE PROCEDURE sp_crear_miembro (
  IN p_proyecto_id INT,
  IN p_nombre VARCHAR(255),
  IN p_iniciales VARCHAR(10)
)
BEGIN
  INSERT INTO miembros_proyecto (proyecto_id, nombre, iniciales)
  VALUES (p_proyecto_id, p_nombre, UPPER(p_iniciales));
  SELECT LAST_INSERT_ID() AS id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_miembros_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_listar_miembros_proyecto (
  IN p_proyecto_id INT
)
BEGIN
  SELECT * FROM miembros_proyecto WHERE proyecto_id = p_proyecto_id ORDER BY nombre;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_eliminar_miembro;
DELIMITER $$
CREATE PROCEDURE sp_eliminar_miembro (
  IN p_id INT
)
BEGIN
  DELETE FROM miembros_proyecto WHERE id = p_id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_asignar_miembro_hu;
DELIMITER $$
CREATE PROCEDURE sp_asignar_miembro_hu (
  IN p_historia_usuario_id INT,
  IN p_miembro_id INT
)
BEGIN
  DECLARE v_existe INT DEFAULT 0;

  SELECT COUNT(*) INTO v_existe FROM hu_miembros
  WHERE historia_usuario_id = p_historia_usuario_id AND miembro_id = p_miembro_id;

  IF v_existe > 0 THEN
    DELETE FROM hu_miembros
    WHERE historia_usuario_id = p_historia_usuario_id AND miembro_id = p_miembro_id;
  ELSE
    INSERT INTO hu_miembros (historia_usuario_id, miembro_id) VALUES (p_historia_usuario_id, p_miembro_id);
  END IF;

  SELECT miembro_id FROM hu_miembros WHERE historia_usuario_id = p_historia_usuario_id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_asignar_miembro_tarea_matriz;
DELIMITER $$
CREATE PROCEDURE sp_asignar_miembro_tarea_matriz (
  IN p_tarea_matriz_id INT,
  IN p_miembro_id INT
)
BEGIN
  DECLARE v_existe INT DEFAULT 0;

  SELECT COUNT(*) INTO v_existe FROM tarea_matriz_miembros
  WHERE tarea_matriz_id = p_tarea_matriz_id AND miembro_id = p_miembro_id;

  IF v_existe > 0 THEN
    DELETE FROM tarea_matriz_miembros
    WHERE tarea_matriz_id = p_tarea_matriz_id AND miembro_id = p_miembro_id;
  ELSE
    INSERT INTO tarea_matriz_miembros (tarea_matriz_id, miembro_id) VALUES (p_tarea_matriz_id, p_miembro_id);
  END IF;

  SELECT miembro_id FROM tarea_matriz_miembros WHERE tarea_matriz_id = p_tarea_matriz_id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_hu_miembros_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_listar_hu_miembros_proyecto (
  IN p_proyecto_id INT
)
BEGIN
  SELECT hm.historia_usuario_id, hm.miembro_id
  FROM hu_miembros hm
  JOIN historias_usuario h ON hm.historia_usuario_id = h.id
  JOIN epicas e ON h.epica_id = e.id
  JOIN modulos m ON e.modulo_id = m.id
  JOIN etapas et ON m.etapa_id = et.id
  WHERE et.proyecto_id = p_proyecto_id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_tarea_matriz_miembros_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_listar_tarea_matriz_miembros_proyecto (
  IN p_proyecto_id INT
)
BEGIN
  SELECT tmm.tarea_matriz_id, tmm.miembro_id
  FROM tarea_matriz_miembros tmm
  JOIN tareas_matrices t ON tmm.tarea_matriz_id = t.id
  JOIN etapas et ON t.etapa_id = et.id
  WHERE et.proyecto_id = p_proyecto_id;
END$$
DELIMITER ;

-- ========================================
-- 12. STORED PROCEDURES: DÍAS REALES (Gantt real, marcado de ejecución)
-- ========================================
-- Mismo patrón de toggle + "el cierre debe ser el último día" que el
-- planificado (ver sección 10), pero acá además se exige que el
-- planificado del proyecto esté 'cerrado' para poder marcar — así no se
-- mezclan las dos ediciones (planificar vs. registrar lo real) al mismo
-- tiempo. Reactivar el planificado (Control de Cambios) vuelve a bloquear
-- el marcado del real hasta cerrarlo de nuevo.

DROP PROCEDURE IF EXISTS sp_marcar_dia_hu_real;
DELIMITER $$
CREATE PROCEDURE sp_marcar_dia_hu_real (
  IN p_historia_usuario_id INT,
  IN p_fecha DATE,
  IN p_tipo_marca VARCHAR(20)
)
BEGIN
  DECLARE v_existe_mismo_tipo INT DEFAULT 0;
  DECLARE v_estado_planificacion VARCHAR(20);
  DECLARE v_max_fecha_trabajo DATE;
  DECLARE v_fecha_cierre_actual DATE;

  SELECT p.estado_planificacion INTO v_estado_planificacion
  FROM historias_usuario h
  JOIN epicas e ON h.epica_id = e.id
  JOIN modulos m ON e.modulo_id = m.id
  JOIN etapas et ON m.etapa_id = et.id
  JOIN proyectos p ON et.proyecto_id = p.id
  WHERE h.id = p_historia_usuario_id;

  IF v_estado_planificacion IS NULL OR v_estado_planificacion <> 'cerrado' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cerrá el planificado primero para poder registrar el real.';
  END IF;

  SELECT COUNT(*) INTO v_existe_mismo_tipo
  FROM hu_dias_reales
  WHERE historia_usuario_id = p_historia_usuario_id AND fecha = p_fecha AND tipo_marca = p_tipo_marca;

  IF v_existe_mismo_tipo > 0 THEN
    DELETE FROM hu_dias_reales
    WHERE historia_usuario_id = p_historia_usuario_id AND fecha = p_fecha;
  ELSE
    IF p_tipo_marca = 'cierre' THEN
      SELECT MAX(fecha) INTO v_max_fecha_trabajo
      FROM hu_dias_reales
      WHERE historia_usuario_id = p_historia_usuario_id AND tipo_marca <> 'cierre';

      IF v_max_fecha_trabajo IS NOT NULL AND v_max_fecha_trabajo > p_fecha THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cierre debe quedar en el último día real de la actividad.';
      END IF;

      DELETE FROM hu_dias_reales
      WHERE historia_usuario_id = p_historia_usuario_id AND tipo_marca = 'cierre';
    ELSE
      SELECT fecha INTO v_fecha_cierre_actual
      FROM hu_dias_reales
      WHERE historia_usuario_id = p_historia_usuario_id AND tipo_marca = 'cierre'
      LIMIT 1;

      IF v_fecha_cierre_actual IS NOT NULL AND p_fecha > v_fecha_cierre_actual THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden marcar días después del cierre real de la actividad.';
      END IF;
    END IF;

    DELETE FROM hu_dias_reales
    WHERE historia_usuario_id = p_historia_usuario_id AND fecha = p_fecha;
    INSERT INTO hu_dias_reales (historia_usuario_id, fecha, tipo_marca)
    VALUES (p_historia_usuario_id, p_fecha, p_tipo_marca);
  END IF;

  SELECT * FROM hu_dias_reales WHERE historia_usuario_id = p_historia_usuario_id ORDER BY fecha;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_marcar_dia_tarea_matriz_real;
DELIMITER $$
CREATE PROCEDURE sp_marcar_dia_tarea_matriz_real (
  IN p_tarea_matriz_id INT,
  IN p_fecha DATE,
  IN p_tipo_marca VARCHAR(20)
)
BEGIN
  DECLARE v_existe_mismo_tipo INT DEFAULT 0;
  DECLARE v_estado_planificacion VARCHAR(20);
  DECLARE v_max_fecha_trabajo DATE;
  DECLARE v_fecha_cierre_actual DATE;

  SELECT p.estado_planificacion INTO v_estado_planificacion
  FROM tareas_matrices t
  JOIN etapas et ON t.etapa_id = et.id
  JOIN proyectos p ON et.proyecto_id = p.id
  WHERE t.id = p_tarea_matriz_id;

  IF v_estado_planificacion IS NULL OR v_estado_planificacion <> 'cerrado' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cerrá el planificado primero para poder registrar el real.';
  END IF;

  SELECT COUNT(*) INTO v_existe_mismo_tipo
  FROM tarea_matriz_dias_reales
  WHERE tarea_matriz_id = p_tarea_matriz_id AND fecha = p_fecha AND tipo_marca = p_tipo_marca;

  IF v_existe_mismo_tipo > 0 THEN
    DELETE FROM tarea_matriz_dias_reales
    WHERE tarea_matriz_id = p_tarea_matriz_id AND fecha = p_fecha;
  ELSE
    IF p_tipo_marca = 'cierre' THEN
      SELECT MAX(fecha) INTO v_max_fecha_trabajo
      FROM tarea_matriz_dias_reales
      WHERE tarea_matriz_id = p_tarea_matriz_id AND tipo_marca <> 'cierre';

      IF v_max_fecha_trabajo IS NOT NULL AND v_max_fecha_trabajo > p_fecha THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cierre debe quedar en el último día real de la actividad.';
      END IF;

      DELETE FROM tarea_matriz_dias_reales
      WHERE tarea_matriz_id = p_tarea_matriz_id AND tipo_marca = 'cierre';
    ELSE
      SELECT fecha INTO v_fecha_cierre_actual
      FROM tarea_matriz_dias_reales
      WHERE tarea_matriz_id = p_tarea_matriz_id AND tipo_marca = 'cierre'
      LIMIT 1;

      IF v_fecha_cierre_actual IS NOT NULL AND p_fecha > v_fecha_cierre_actual THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden marcar días después del cierre real de la actividad.';
      END IF;
    END IF;

    DELETE FROM tarea_matriz_dias_reales
    WHERE tarea_matriz_id = p_tarea_matriz_id AND fecha = p_fecha;
    INSERT INTO tarea_matriz_dias_reales (tarea_matriz_id, fecha, tipo_marca)
    VALUES (p_tarea_matriz_id, p_fecha, p_tipo_marca);
  END IF;

  SELECT * FROM tarea_matriz_dias_reales WHERE tarea_matriz_id = p_tarea_matriz_id ORDER BY fecha;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_dias_hu_real_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_listar_dias_hu_real_proyecto (
  IN p_proyecto_id INT
)
BEGIN
  SELECT d.historia_usuario_id, d.fecha, d.tipo_marca
  FROM hu_dias_reales d
  JOIN historias_usuario h ON d.historia_usuario_id = h.id
  JOIN epicas e ON h.epica_id = e.id
  JOIN modulos m ON e.modulo_id = m.id
  JOIN etapas et ON m.etapa_id = et.id
  WHERE et.proyecto_id = p_proyecto_id
  ORDER BY d.fecha;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_dias_tarea_matriz_real_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_listar_dias_tarea_matriz_real_proyecto (
  IN p_proyecto_id INT
)
BEGIN
  SELECT d.tarea_matriz_id, d.fecha, d.tipo_marca
  FROM tarea_matriz_dias_reales d
  JOIN tareas_matrices t ON d.tarea_matriz_id = t.id
  JOIN etapas et ON t.etapa_id = et.id
  WHERE et.proyecto_id = p_proyecto_id
  ORDER BY d.fecha;
END$$
DELIMITER ;

-- ========================================
-- 13. STORED PROCEDURES: BASELINE (listado, para "Días Totales")
-- ========================================
-- El baseline (planificado inicial, capturado en el primer "Cerrar
-- Planificado") es el denominador fijo del reporte Avance Célula — no
-- cambia aunque después se replanifique o avance el real.

DROP PROCEDURE IF EXISTS sp_listar_dias_hu_baseline_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_listar_dias_hu_baseline_proyecto (
  IN p_proyecto_id INT
)
BEGIN
  SELECT d.historia_usuario_id, d.fecha, d.tipo_marca
  FROM hu_dias_planificados_baseline d
  JOIN historias_usuario h ON d.historia_usuario_id = h.id
  JOIN epicas e ON h.epica_id = e.id
  JOIN modulos m ON e.modulo_id = m.id
  JOIN etapas et ON m.etapa_id = et.id
  WHERE et.proyecto_id = p_proyecto_id
  ORDER BY d.fecha;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_dias_tarea_matriz_baseline_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_listar_dias_tarea_matriz_baseline_proyecto (
  IN p_proyecto_id INT
)
BEGIN
  SELECT d.tarea_matriz_id, d.fecha, d.tipo_marca
  FROM tarea_matriz_dias_planificados_baseline d
  JOIN tareas_matrices t ON d.tarea_matriz_id = t.id
  JOIN etapas et ON t.etapa_id = et.id
  WHERE et.proyecto_id = p_proyecto_id
  ORDER BY d.fecha;
END$$
DELIMITER ;

-- ========================================
-- 14. STORED PROCEDURES: CORTES DE AVANCE (Avance Célula)
-- ========================================
-- Guardar un corte es: (1) crear/reusar la fila de cortes_avance para
-- hoy, (2) borrar su detalle anterior si ya existía (reemplazo, no
-- duplicado) y (3) insertar el detalle fila por fila desde el servicio
-- Node (un corte tiene tantas filas como etapas/épicas/tareas matrices
-- tenga el proyecto — no tiene sentido un SP con una lista de tamaño
-- variable, se arma con un loop de llamadas igual que la plantilla
-- estándar en plantillaService.ts).

DROP PROCEDURE IF EXISTS sp_crear_o_reusar_corte_avance;
DELIMITER $$
CREATE PROCEDURE sp_crear_o_reusar_corte_avance (
  IN p_proyecto_id INT,
  IN p_fecha_corte DATE
)
BEGIN
  DECLARE v_corte_id INT;

  SELECT id INTO v_corte_id FROM cortes_avance
  WHERE proyecto_id = p_proyecto_id AND fecha_corte = p_fecha_corte;

  IF v_corte_id IS NULL THEN
    INSERT INTO cortes_avance (proyecto_id, fecha_corte) VALUES (p_proyecto_id, p_fecha_corte);
    SET v_corte_id = LAST_INSERT_ID();
  ELSE
    DELETE FROM cortes_avance_detalle WHERE corte_id = v_corte_id;
  END IF;

  SELECT v_corte_id AS id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_agregar_detalle_corte_avance;
DELIMITER $$
CREATE PROCEDURE sp_agregar_detalle_corte_avance (
  IN p_corte_id INT,
  IN p_tipo VARCHAR(20),
  IN p_referencia_id INT,
  IN p_etapa_nombre VARCHAR(255),
  IN p_nombre VARCHAR(500),
  IN p_orden INT,
  IN p_dias_totales INT,
  IN p_dias_planificados INT,
  IN p_dias_reales INT
)
BEGIN
  INSERT INTO cortes_avance_detalle
    (corte_id, tipo, referencia_id, etapa_nombre, nombre, orden, dias_totales, dias_planificados, dias_reales)
  VALUES
    (p_corte_id, p_tipo, p_referencia_id, p_etapa_nombre, p_nombre, p_orden, p_dias_totales, p_dias_planificados, p_dias_reales);
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_cortes_avance;
DELIMITER $$
CREATE PROCEDURE sp_listar_cortes_avance (
  IN p_proyecto_id INT
)
BEGIN
  SELECT * FROM cortes_avance WHERE proyecto_id = p_proyecto_id ORDER BY fecha_corte DESC;
END$$
DELIMITER ;

-- El corte anterior al de hoy: el más reciente con fecha < hoy (si hoy ya
-- tiene uno guardado, igual se compara contra el de ANTES de hoy, no
-- contra sí mismo).
DROP PROCEDURE IF EXISTS sp_obtener_corte_anterior;
DELIMITER $$
CREATE PROCEDURE sp_obtener_corte_anterior (
  IN p_proyecto_id INT,
  IN p_fecha_corte DATE
)
BEGIN
  SELECT * FROM cortes_avance
  WHERE proyecto_id = p_proyecto_id AND fecha_corte < p_fecha_corte
  ORDER BY fecha_corte DESC
  LIMIT 1;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_detalle_corte_avance;
DELIMITER $$
CREATE PROCEDURE sp_listar_detalle_corte_avance (
  IN p_corte_id INT
)
BEGIN
  SELECT * FROM cortes_avance_detalle WHERE corte_id = p_corte_id ORDER BY orden;
END$$
DELIMITER ;

-- Resumen liviano para la lista de proyectos: días planificados y reales
-- de TODOS los proyectos en una sola pasada (evita N+1 al listar). No usa
-- el baseline — el % Cumplimiento (real/planificado) no lo necesita.
DROP PROCEDURE IF EXISTS sp_resumen_cumplimiento_proyectos;
DELIMITER $$
CREATE PROCEDURE sp_resumen_cumplimiento_proyectos ()
BEGIN
  SELECT
    p.id AS proyecto_id,
    COALESCE(planif_hu.dias, 0) + COALESCE(planif_tm.dias, 0) AS dias_planificados,
    COALESCE(real_hu.dias, 0) + COALESCE(real_tm.dias, 0) AS dias_reales
  FROM proyectos p
  LEFT JOIN (
    SELECT et.proyecto_id, COUNT(*) AS dias
    FROM hu_dias_planificados d
    JOIN historias_usuario h ON d.historia_usuario_id = h.id
    JOIN epicas e ON h.epica_id = e.id
    JOIN modulos m ON e.modulo_id = m.id
    JOIN etapas et ON m.etapa_id = et.id
    WHERE d.tipo_marca <> 'cierre'
    GROUP BY et.proyecto_id
  ) planif_hu ON planif_hu.proyecto_id = p.id
  LEFT JOIN (
    SELECT et.proyecto_id, COUNT(*) AS dias
    FROM tarea_matriz_dias_planificados d
    JOIN tareas_matrices t ON d.tarea_matriz_id = t.id
    JOIN etapas et ON t.etapa_id = et.id
    WHERE d.tipo_marca <> 'cierre'
    GROUP BY et.proyecto_id
  ) planif_tm ON planif_tm.proyecto_id = p.id
  LEFT JOIN (
    SELECT et.proyecto_id, COUNT(*) AS dias
    FROM hu_dias_reales d
    JOIN historias_usuario h ON d.historia_usuario_id = h.id
    JOIN epicas e ON h.epica_id = e.id
    JOIN modulos m ON e.modulo_id = m.id
    JOIN etapas et ON m.etapa_id = et.id
    WHERE d.tipo_marca <> 'cierre'
    GROUP BY et.proyecto_id
  ) real_hu ON real_hu.proyecto_id = p.id
  LEFT JOIN (
    SELECT et.proyecto_id, COUNT(*) AS dias
    FROM tarea_matriz_dias_reales d
    JOIN tareas_matrices t ON d.tarea_matriz_id = t.id
    JOIN etapas et ON t.etapa_id = et.id
    WHERE d.tipo_marca <> 'cierre'
    GROUP BY et.proyecto_id
  ) real_tm ON real_tm.proyecto_id = p.id;
END$$
DELIMITER ;

-- ========================================
-- 16. OBSERVACIONES (inventario de observaciones de certificación por HU)
-- ========================================
-- Cada HU puede tener varias observaciones levantadas en certificación.
-- El estado es libre (cualquier transición, sin flujo forzado) porque en
-- la práctica una observación puede saltar etapas o volver atrás. Cada
-- cambio de estado queda en `observaciones_historial` — eso es a la vez
-- el registro de auditoría y la fuente de "cuántas iteraciones" tuvo la
-- observación (una iteración = una transición de estado después de
-- creada, no cuenta la creación en sí).

CREATE TABLE IF NOT EXISTS observaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  historia_usuario_id INT NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion LONGTEXT,
  estado ENUM('en_atencion', 'en_analisis', 'en_publicacion', 're_test', 'certificada') NOT NULL DEFAULT 'en_atencion',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (historia_usuario_id) REFERENCES historias_usuario(id) ON DELETE CASCADE,
  INDEX idx_obs_hu (historia_usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS observaciones_historial (
  id INT AUTO_INCREMENT PRIMARY KEY,
  observacion_id INT NOT NULL,
  estado_anterior ENUM('en_atencion', 'en_analisis', 'en_publicacion', 're_test', 'certificada'),
  estado_nuevo ENUM('en_atencion', 'en_analisis', 'en_publicacion', 're_test', 'certificada') NOT NULL,
  nota LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (observacion_id) REFERENCES observaciones(id) ON DELETE CASCADE,
  INDEX idx_obshist_obs (observacion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Imágenes guardadas como BLOB en la propia base (sin depender de disco
-- persistente ni de un servicio externo — el filesystem del contenedor en
-- Railway es efímero, así que un archivo en disco se perdería en cada
-- redeploy).
CREATE TABLE IF NOT EXISTS observaciones_imagenes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  observacion_id INT NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  tipo_mime VARCHAR(100) NOT NULL,
  contenido LONGBLOB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (observacion_id) REFERENCES observaciones(id) ON DELETE CASCADE,
  INDEX idx_obsimg_obs (observacion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS observaciones_miembros (
  observacion_id INT NOT NULL,
  miembro_id INT NOT NULL,
  PRIMARY KEY (observacion_id, miembro_id),
  FOREIGN KEY (observacion_id) REFERENCES observaciones(id) ON DELETE CASCADE,
  FOREIGN KEY (miembro_id) REFERENCES miembros_proyecto(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS sp_crear_observacion;
DELIMITER $$
CREATE PROCEDURE sp_crear_observacion (
  IN p_historia_usuario_id INT,
  IN p_titulo VARCHAR(255),
  IN p_descripcion LONGTEXT
)
BEGIN
  DECLARE v_id INT;
  INSERT INTO observaciones (historia_usuario_id, titulo, descripcion, estado)
  VALUES (p_historia_usuario_id, p_titulo, p_descripcion, 'en_atencion');
  SET v_id = LAST_INSERT_ID();
  INSERT INTO observaciones_historial (observacion_id, estado_anterior, estado_nuevo)
  VALUES (v_id, NULL, 'en_atencion');
  SELECT * FROM observaciones WHERE id = v_id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_observaciones_hu;
DELIMITER $$
CREATE PROCEDURE sp_listar_observaciones_hu (
  IN p_historia_usuario_id INT
)
BEGIN
  SELECT o.*,
    (SELECT COUNT(*) FROM observaciones_historial oh WHERE oh.observacion_id = o.id AND oh.estado_anterior IS NOT NULL) AS iteraciones,
    (SELECT COUNT(*) FROM observaciones_imagenes oi WHERE oi.observacion_id = o.id) AS cantidad_imagenes
  FROM observaciones o
  WHERE o.historia_usuario_id = p_historia_usuario_id
  ORDER BY (o.estado = 'certificada') ASC, o.created_at ASC;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_obtener_observacion;
DELIMITER $$
CREATE PROCEDURE sp_obtener_observacion (
  IN p_id INT
)
BEGIN
  SELECT * FROM observaciones WHERE id = p_id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_cambiar_estado_observacion;
DELIMITER $$
CREATE PROCEDURE sp_cambiar_estado_observacion (
  IN p_id INT,
  IN p_estado_nuevo VARCHAR(20),
  IN p_nota LONGTEXT
)
BEGIN
  DECLARE v_estado_actual VARCHAR(20);

  SELECT estado INTO v_estado_actual FROM observaciones WHERE id = p_id;

  IF v_estado_actual IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La observación no existe.';
  END IF;

  UPDATE observaciones SET estado = p_estado_nuevo WHERE id = p_id;
  INSERT INTO observaciones_historial (observacion_id, estado_anterior, estado_nuevo, nota)
  VALUES (p_id, v_estado_actual, p_estado_nuevo, p_nota);

  SELECT * FROM observaciones WHERE id = p_id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_eliminar_observacion;
DELIMITER $$
CREATE PROCEDURE sp_eliminar_observacion (
  IN p_id INT
)
BEGIN
  DELETE FROM observaciones WHERE id = p_id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_historial_observacion;
DELIMITER $$
CREATE PROCEDURE sp_listar_historial_observacion (
  IN p_observacion_id INT
)
BEGIN
  SELECT * FROM observaciones_historial WHERE observacion_id = p_observacion_id ORDER BY created_at ASC;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_asignar_miembro_observacion;
DELIMITER $$
CREATE PROCEDURE sp_asignar_miembro_observacion (
  IN p_observacion_id INT,
  IN p_miembro_id INT
)
BEGIN
  DECLARE v_existe INT DEFAULT 0;

  SELECT COUNT(*) INTO v_existe FROM observaciones_miembros
  WHERE observacion_id = p_observacion_id AND miembro_id = p_miembro_id;

  IF v_existe > 0 THEN
    DELETE FROM observaciones_miembros
    WHERE observacion_id = p_observacion_id AND miembro_id = p_miembro_id;
  ELSE
    INSERT INTO observaciones_miembros (observacion_id, miembro_id) VALUES (p_observacion_id, p_miembro_id);
  END IF;

  SELECT miembro_id FROM observaciones_miembros WHERE observacion_id = p_observacion_id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_miembros_observacion;
DELIMITER $$
CREATE PROCEDURE sp_listar_miembros_observacion (
  IN p_observacion_id INT
)
BEGIN
  -- Trae el miembro completo (no solo el id): el detalle de una
  -- observación no tiene ya cargada la lista de miembros del proyecto
  -- como sí la tiene el Gantt, así que evita una consulta extra.
  SELECT mp.*
  FROM observaciones_miembros om
  JOIN miembros_proyecto mp ON om.miembro_id = mp.id
  WHERE om.observacion_id = p_observacion_id
  ORDER BY mp.nombre;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_agregar_imagen_observacion;
DELIMITER $$
CREATE PROCEDURE sp_agregar_imagen_observacion (
  IN p_observacion_id INT,
  IN p_nombre_archivo VARCHAR(255),
  IN p_tipo_mime VARCHAR(100),
  IN p_contenido LONGBLOB
)
BEGIN
  INSERT INTO observaciones_imagenes (observacion_id, nombre_archivo, tipo_mime, contenido)
  VALUES (p_observacion_id, p_nombre_archivo, p_tipo_mime, p_contenido);
  SELECT LAST_INSERT_ID() AS id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_imagenes_observacion;
DELIMITER $$
CREATE PROCEDURE sp_listar_imagenes_observacion (
  IN p_observacion_id INT
)
BEGIN
  -- Sin `contenido`: esto alimenta la grilla de miniaturas (que pide cada
  -- imagen por separado vía sp_obtener_imagen_observacion), no tiene
  -- sentido viajar los bytes acá y de nuevo en cada <img>.
  SELECT id, observacion_id, nombre_archivo, tipo_mime, created_at
  FROM observaciones_imagenes
  WHERE observacion_id = p_observacion_id
  ORDER BY created_at ASC;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_obtener_imagen_observacion;
DELIMITER $$
CREATE PROCEDURE sp_obtener_imagen_observacion (
  IN p_id INT
)
BEGIN
  SELECT id, tipo_mime, nombre_archivo, contenido FROM observaciones_imagenes WHERE id = p_id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_eliminar_imagen_observacion;
DELIMITER $$
CREATE PROCEDURE sp_eliminar_imagen_observacion (
  IN p_id INT
)
BEGIN
  DELETE FROM observaciones_imagenes WHERE id = p_id;
END$$
DELIMITER ;

-- ========================================
-- 17. INVENTARIO DE OBSERVACIONES POR PROYECTO
-- ========================================
-- Filtros y orden se resuelven en la capa de servicio (Node), no acá —
-- estas SPs devuelven todo lo necesario en pocas consultas (evitar N+1)
-- y el filtrado/orden se aplica en memoria, mismo patrón que
-- estructuraService.

DROP PROCEDURE IF EXISTS sp_listar_observaciones_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_listar_observaciones_proyecto (
  IN p_proyecto_id INT
)
BEGIN
  SELECT
    o.id, o.historia_usuario_id, o.titulo, o.descripcion, o.estado, o.created_at, o.updated_at,
    h.codigo AS hu_codigo, h.titulo AS hu_titulo,
    e.id AS epica_id, e.nombre AS epica_nombre,
    m.id AS modulo_id, m.nombre AS modulo_nombre,
    et.id AS etapa_id, et.nombre AS etapa_nombre
  FROM observaciones o
  JOIN historias_usuario h ON o.historia_usuario_id = h.id
  JOIN epicas e ON h.epica_id = e.id
  JOIN modulos m ON e.modulo_id = m.id
  JOIN etapas et ON m.etapa_id = et.id
  WHERE et.proyecto_id = p_proyecto_id
  ORDER BY (o.estado = 'certificada') ASC, o.created_at ASC;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_iteraciones_observaciones_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_listar_iteraciones_observaciones_proyecto (
  IN p_proyecto_id INT
)
BEGIN
  SELECT oh.observacion_id, COUNT(*) AS iteraciones
  FROM observaciones_historial oh
  JOIN observaciones o ON oh.observacion_id = o.id
  JOIN historias_usuario h ON o.historia_usuario_id = h.id
  JOIN epicas e ON h.epica_id = e.id
  JOIN modulos m ON e.modulo_id = m.id
  JOIN etapas et ON m.etapa_id = et.id
  WHERE et.proyecto_id = p_proyecto_id AND oh.estado_anterior IS NOT NULL
  GROUP BY oh.observacion_id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_conteo_imagenes_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_listar_conteo_imagenes_proyecto (
  IN p_proyecto_id INT
)
BEGIN
  SELECT oi.observacion_id, COUNT(*) AS cantidad
  FROM observaciones_imagenes oi
  JOIN observaciones o ON oi.observacion_id = o.id
  JOIN historias_usuario h ON o.historia_usuario_id = h.id
  JOIN epicas e ON h.epica_id = e.id
  JOIN modulos m ON e.modulo_id = m.id
  JOIN etapas et ON m.etapa_id = et.id
  WHERE et.proyecto_id = p_proyecto_id
  GROUP BY oi.observacion_id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_miembros_observaciones_proyecto;
DELIMITER $$
CREATE PROCEDURE sp_listar_miembros_observaciones_proyecto (
  IN p_proyecto_id INT
)
BEGIN
  SELECT om.observacion_id, om.miembro_id
  FROM observaciones_miembros om
  JOIN observaciones o ON om.observacion_id = o.id
  JOIN historias_usuario h ON o.historia_usuario_id = h.id
  JOIN epicas e ON h.epica_id = e.id
  JOIN modulos m ON e.modulo_id = m.id
  JOIN etapas et ON m.etapa_id = et.id
  WHERE et.proyecto_id = p_proyecto_id;
END$$
DELIMITER ;

-- ========================================
-- 18. CORTES DE OBSERVACIONES (evolución de HU abiertas/certificadas)
-- ========================================
-- Snapshot manual (no hay cron): cada "Guardar corte" es una fila nueva,
-- con fecha_hora completa (no solo fecha) — a diferencia de los cortes de
-- Avance Célula (que hacen upsert por día), acá cada guardado queda como
-- un punto propio en la línea de tiempo, para poder trackear evolución
-- incluso varias veces por día/hora si hace falta. Los conteos se calculan
-- en la capa de servicio (Node) a partir del inventario ya cargado, y acá
-- solo se persisten.

CREATE TABLE IF NOT EXISTS cortes_observaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proyecto_id INT NOT NULL,
  fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_hu_con_observaciones INT NOT NULL DEFAULT 0,
  hu_abiertas INT NOT NULL DEFAULT 0,
  hu_certificadas INT NOT NULL DEFAULT 0,
  total_observaciones INT NOT NULL DEFAULT 0,
  observaciones_abiertas INT NOT NULL DEFAULT 0,
  observaciones_certificadas INT NOT NULL DEFAULT 0,
  FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
  INDEX idx_corteobs_proyecto (proyecto_id, fecha_hora)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS sp_guardar_corte_observaciones;
DELIMITER $$
CREATE PROCEDURE sp_guardar_corte_observaciones (
  IN p_proyecto_id INT,
  IN p_total_hu INT,
  IN p_hu_abiertas INT,
  IN p_hu_certificadas INT,
  IN p_total_obs INT,
  IN p_obs_abiertas INT,
  IN p_obs_certificadas INT
)
BEGIN
  INSERT INTO cortes_observaciones (
    proyecto_id, total_hu_con_observaciones, hu_abiertas, hu_certificadas,
    total_observaciones, observaciones_abiertas, observaciones_certificadas
  )
  VALUES (p_proyecto_id, p_total_hu, p_hu_abiertas, p_hu_certificadas, p_total_obs, p_obs_abiertas, p_obs_certificadas);

  SELECT * FROM cortes_observaciones WHERE id = LAST_INSERT_ID();
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_listar_cortes_observaciones;
DELIMITER $$
CREATE PROCEDURE sp_listar_cortes_observaciones (
  IN p_proyecto_id INT
)
BEGIN
  SELECT * FROM cortes_observaciones WHERE proyecto_id = p_proyecto_id ORDER BY fecha_hora ASC;
END$$
DELIMITER ;
