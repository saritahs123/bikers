/**
 * FASE 6 — SUITE DE PRUEBAS DE ACEPTACIÓN DE USUARIOS Y VALIDACIÓN DE INTERFAZ
 * Ride Lab - Bikers' Fort Core
 *
 * Valida los 7 perfiles de usuario solicitados:
 * 1. Solo lectura
 * 2. Operador de taller
 * 3. Supervisor
 * 4. Encargado de inventario
 * 5. Encargado de facturación
 * 6. Usuario con permisos personalizados
 * 7. Usuario sin permisos
 *
 * Más:
 * - Aislamiento de cuentas (prefijo test_p6_*)
 * - Verificación de consistencia Interfaz <-> Sesión <-> Motor RBAC <-> APIs
 * - Prueba de actualización dinámica tras cambio de rol
 * - Limpieza final completa: CERO RESIDUOS EN PRODUCCIÓN
 */

const { Pool } = require('pg');
const crypto = require('crypto');

const BASE_URL = process.env.TEST_APP_URL || 'http://localhost:3000';

// BLOQUEO ESTRICTO: Prevenir ejecución accidental sobre la base de producción
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('db.bikerrd.com') && process.env.ALLOW_PROD_TESTS !== 'true') {
  console.error('\n======================================================================');
  console.error('[BLOQUEO DE SEGURIDAD] Este script de pruebas NO debe ejecutarse');
  console.error('contra la base de datos de producción AWS RDS (db.bikerrd.com).');
  console.error('Configure un entorno PostgreSQL aislado o establezca ALLOW_PROD_TESTS=true');
  console.error('únicamente si cuenta con autorización explícita para pruebas.');
  console.error('======================================================================\n');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.DATABASE_URL?.includes('127.0.0.1') || process.env.DATABASE_URL?.includes('localhost')) ? false : { rejectUnauthorized: false }
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

async function runPhase6Tests() {
  const client = await pool.connect();
  const testResults = [];
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message, details = '') {
    if (condition) {
      passedCount++;
      console.log(`  [PASS] ${message}`);
      testResults.push({ status: 'PASS', message, details });
    } else {
      failedCount++;
      const isNetError = String(details).includes('status: 0') || String(details).includes('Status: 0');
      const prefix = isNetError ? '[ERROR_RED/TIMEOUT]' : '[FAIL]';
      console.error(`  ${prefix} ${message} - Detalle: ${details}`);
      testResults.push({ status: 'FAIL', message, details });
    }
  }

  console.log('\n=== INICIANDO FASE 6: PRUEBAS DE ACEPTACIÓN DE USUARIOS Y VALIDACIÓN DE INTERFAZ ===');
  console.log(`Conectando al servidor HTTP: ${BASE_URL}\n`);

  // Registros temporales a limpiar
  const cleanupUsers = [];
  const cleanupRoles = [];
  const cleanupWorkOrders = [];
  const cleanupInvoices = [];

  try {
    // 1. Obtener empresa base y tipos
    const empRes = await client.query("SELECT empresa_id FROM admin.empresa ORDER BY empresa_id LIMIT 1");
    const empresaId = empRes.rows[0]?.empresa_id || 1;

    const tipoUserRes = await client.query("SELECT tipo_usuario_id FROM admin.tipo_usuario LIMIT 1");
    const tipoUserId = tipoUserRes.rows[0]?.tipo_usuario_id || 1;

    // Obtener referencias válidas para órdenes de trabajo
    const refOtRes = await client.query("SELECT recepcion_id, cliente_id, bicicleta_id FROM admin.ordenes_trabajo LIMIT 1");
    const recId = refOtRes.rows[0]?.recepcion_id || 480;
    const cliId = refOtRes.rows[0]?.cliente_id || 97;
    const bikeId = refOtRes.rows[0]?.bicicleta_id || 35;

    // Obtener pantallas del sistema
    const scrRows = (await client.query("SELECT pantalla_id, codigo, ruta FROM admin.pantalla_sistema")).rows;
    const screens = {};
    for (const s of scrRows) {
      if (s.codigo) screens[s.codigo] = s.pantalla_id;
      if (s.ruta) screens[s.ruta] = s.pantalla_id;
    }

    const scrFacId = screens['FACTURACION_FACTURAS'] || screens['/billing/invoices'];
    const scrOtId = screens['TALLER_ORDENES'] || screens['/workshop/work-orders'];
    const scrTransId = screens['INVENTARIO_TRANSFERENCIAS'] || screens['/inventory/transfers'];
    const scrAjuId = screens['INVENTARIO_AJUSTES'] || screens['/inventory/adjustments'];
    const scrInitId = screens['INVENTARIO_INICIAL'] || screens['/inventory/initial'];
    const scrDashId = screens['DASHBOARD'] || screens['/'];

    // Obtener módulos del sistema
    const modRows = (await client.query("SELECT modulo_sistema_id, nombre FROM admin.modulo_sistema")).rows;
    const modules = {};
    for (const m of modRows) {
      if (m.nombre) {
        const norm = m.nombre.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        modules[norm] = m.modulo_sistema_id;
      }
    }
    const modFacId = modules['FACTURACION'] || 10;
    const modTallerId = modules['TALLER'] || 7;
    const modInvId = modules['INVENTARIO'] || 8;

    // Limpieza preventiva de pruebas anteriores con el prefijo TEST_ROL_ o test_p6_
    const prevUsers = (await client.query("SELECT usuario_id FROM admin.usuario_seguridad WHERE identificador_principal LIKE 'test_p6_%'")).rows.map(r => r.usuario_id);
    if (prevUsers.length > 0) {
      await client.query("DELETE FROM admin.factura_anulacion WHERE usuario_anulacion_id = ANY($1::int[]) OR usuario_autorizacion_id = ANY($1::int[])", [prevUsers]);
      await client.query("DELETE FROM admin.usuario_actividad WHERE usuario_id = ANY($1::int[])", [prevUsers]);
      await client.query("DELETE FROM admin.usuario_auditoria WHERE usuario_id = ANY($1::int[]) OR admin_id = ANY($1::int[])", [prevUsers]);
      await client.query("DELETE FROM admin.usuario_sesion WHERE usuario_id = ANY($1::int[]) OR revocado_por = ANY($1::int[])", [prevUsers]);
      await client.query("DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = ANY($1::int[])", [prevUsers]);
      await client.query("DELETE FROM admin.usuario_rol_adicional WHERE usuario_id = ANY($1::int[])", [prevUsers]);
      await client.query("DELETE FROM admin.usuario_seguridad WHERE usuario_id = ANY($1::int[])", [prevUsers]);
      await client.query("DELETE FROM admin.usuario_identidad WHERE usuario_id = ANY($1::int[])", [prevUsers]);
      await client.query("DELETE FROM admin.usuario_alcance WHERE usuario_id = ANY($1::int[])", [prevUsers]);
      await client.query("DELETE FROM admin.usuario_configuracion_acceso WHERE usuario_id = ANY($1::int[])", [prevUsers]);
      await client.query("DELETE FROM admin.usuario WHERE usuario_id = ANY($1::int[])", [prevUsers]);
    }
    const prevRoles = (await client.query("SELECT rol_funcional_id FROM admin.rol_funcional WHERE nombre LIKE 'TEST_ROL_%'")).rows.map(r => r.rol_funcional_id);
    if (prevRoles.length > 0) {
      await client.query("DELETE FROM admin.matriz_acceso_rol WHERE rol_funcional_id = ANY($1::int[])", [prevRoles]);
      await client.query("DELETE FROM admin.matriz_acceso_pantalla WHERE rol_funcional_id = ANY($1::int[])", [prevRoles]);
      await client.query("DELETE FROM admin.rol_funcional WHERE rol_funcional_id = ANY($1::int[])", [prevRoles]);
    }
    const prevOts = (await client.query("SELECT orden_trabajo_id FROM admin.ordenes_trabajo WHERE codigo_orden LIKE 'TEST-P6-%'")).rows.map(r => r.orden_trabajo_id);
    if (prevOts.length > 0) {
      await client.query("DELETE FROM admin.facturas WHERE orden_trabajo_id = ANY($1::int[])", [prevOts]);
      await client.query("DELETE FROM admin.orden_historial WHERE orden_trabajo_id = ANY($1::int[])", [prevOts]);
      await client.query("DELETE FROM admin.orden_servicios WHERE orden_trabajo_id = ANY($1::int[])", [prevOts]);
      await client.query("DELETE FROM admin.orden_productos WHERE orden_trabajo_id = ANY($1::int[])", [prevOts]);
      await client.query("DELETE FROM admin.ordenes_trabajo WHERE orden_trabajo_id = ANY($1::int[])", [prevOts]);
    }
    const prevFacs = (await client.query("SELECT factura_id FROM admin.facturas WHERE numero_factura LIKE 'TEST-P6-%' OR numero_factura LIKE 'TEST-FAC-%'")).rows.map(r => r.factura_id);
    if (prevFacs.length > 0) {
      await client.query("DELETE FROM admin.factura_anulacion WHERE factura_id = ANY($1::int[])", [prevFacs]);
      await client.query("DELETE FROM admin.pagos WHERE factura_id = ANY($1::int[])", [prevFacs]);
      await client.query("DELETE FROM admin.detalle_factura WHERE factura_id = ANY($1::int[])", [prevFacs]);
      await client.query("DELETE FROM admin.facturas WHERE factura_id = ANY($1::int[])", [prevFacs]);
    }

    // 2. Definición de perfiles
    const maxU = Number((await client.query("SELECT COALESCE(MAX(usuario_id), 0) as m FROM admin.usuario")).rows[0].m);
    const maxR = Number((await client.query("SELECT COALESCE(MAX(rol_funcional_id), 0) as m FROM admin.rol_funcional")).rows[0].m);
    const maxSeg = Number((await client.query("SELECT COALESCE(MAX(usuario_seguridad_id), 0) as m FROM admin.usuario_seguridad")).rows[0].m);
    let maxMatrizRolId = Number((await client.query("SELECT COALESCE(MAX(matriz_acceso_rol_id), 0) as m FROM admin.matriz_acceso_rol")).rows[0].m);

    const profiles = [
      {
        key: 'readonly',
        name: 'Usuario Solo Lectura',
        username: 'test_p6_readonly',
        email: 'test_p6_readonly@ridelab.test',
        userId: maxU + 101,
        roleId: maxR + 101,
        roleName: 'TEST_ROL_SOLO_LECTURA',
        perms: {
          [scrFacId]: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false, exportar: false },
          [scrOtId]: { ver: true, crear: false, editar: false, eliminar: false, asignar: false, cerrar: false, reabrir: false, mover: false },
          [scrTransId]: { ver: true, mover: false },
          [scrAjuId]: { ver: true, crear: false, aprobar: false },
          [scrDashId]: { ver: false },
        },
        modPerms: {
          [modFacId]: { ver: true, crear: false, editar: false },
          [modTallerId]: { ver: true, crear: false, editar: false },
          [modInvId]: { ver: true, crear: false, editar: false },
        }
      },
      {
        key: 'taller',
        name: 'Operador de Taller',
        username: 'test_p6_taller',
        email: 'test_p6_taller@ridelab.test',
        userId: maxU + 102,
        roleId: maxR + 102,
        roleName: 'TEST_ROL_OPERADOR_TALLER',
        perms: {
          [scrOtId]: { ver: true, crear: true, editar: true, mover: true, asignar: false, cerrar: false, reabrir: false, eliminar: false },
          [scrFacId]: { ver: false },
          [scrTransId]: { ver: false },
          [scrAjuId]: { ver: false },
          [scrDashId]: { ver: true },
        },
        modPerms: {
          [modTallerId]: { ver: true, crear: true, editar: true, mover: true, asignar: false, cerrar: false },
          [modFacId]: { ver: false },
          [modInvId]: { ver: false },
        }
      },
      {
        key: 'supervisor',
        name: 'Supervisor',
        username: 'test_p6_supervisor',
        email: 'test_p6_supervisor@ridelab.test',
        userId: maxU + 103,
        roleId: maxR + 103,
        roleName: 'TEST_ROL_SUPERVISOR',
        perms: {
          [scrOtId]: { ver: true, crear: true, editar: true, mover: true, asignar: true, cerrar: true, reabrir: true, eliminar: true },
          [scrFacId]: { ver: true, crear: true, editar: true, aprobar: true, exportar: true },
          [scrAjuId]: { ver: true, crear: true, aprobar: true },
          [scrTransId]: { ver: true, mover: true },
          [scrDashId]: { ver: true },
        },
        modPerms: {
          [modTallerId]: { ver: true, crear: true, editar: true, asignar: true, cerrar: true, reabrir: true, mover: true },
          [modFacId]: { ver: true, crear: true, editar: true, aprobar: true, exportar: true },
          [modInvId]: { ver: true, crear: true, aprobar: true, mover: true },
        }
      },
      {
        key: 'inventario',
        name: 'Encargado de Inventario',
        username: 'test_p6_inventario',
        email: 'test_p6_inventario@ridelab.test',
        userId: maxU + 104,
        roleId: maxR + 104,
        roleName: 'TEST_ROL_ENCARGADO_INVENTARIO',
        perms: {
          [scrTransId]: { ver: true, mover: true },
          [scrAjuId]: { ver: true, crear: true, aprobar: false },
          [scrInitId]: { ver: true, importar: true },
          [scrOtId]: { ver: false },
          [scrFacId]: { ver: false },
          [scrDashId]: { ver: true },
        },
        modPerms: {
          [modInvId]: { ver: true, crear: true, mover: true, importar: true, aprobar: false },
          [modTallerId]: { ver: false },
          [modFacId]: { ver: false },
        }
      },
      {
        key: 'facturacion',
        name: 'Encargado de Facturación',
        username: 'test_p6_facturacion',
        email: 'test_p6_facturacion@ridelab.test',
        userId: maxU + 105,
        roleId: maxR + 105,
        roleName: 'TEST_ROL_ENCARGADO_FACTURACION',
        perms: {
          [scrFacId]: { ver: true, crear: true, editar: true, exportar: true, aprobar: false },
          [scrOtId]: { ver: false },
          [scrTransId]: { ver: false },
          [scrAjuId]: { ver: false },
          [scrDashId]: { ver: true },
        },
        modPerms: {
          [modFacId]: { ver: true, crear: true, editar: true, exportar: true, aprobar: false },
          [modTallerId]: { ver: false },
          [modInvId]: { ver: false },
        }
      },
      {
        key: 'personalizado',
        name: 'Usuario con Permisos Personalizados',
        username: 'test_p6_personalizado',
        email: 'test_p6_personalizado@ridelab.test',
        userId: maxU + 106,
        roleId: maxR + 106,
        roleName: 'TEST_ROL_BASE_PERSONALIZADO',
        perms: {
          [scrOtId]: { ver: true, crear: true, editar: true, asignar: true, cerrar: true, mover: true },
          [scrFacId]: { ver: true, crear: true, aprobar: false },
          [scrDashId]: { ver: true },
        },
        modPerms: {
          [modTallerId]: { ver: true, crear: true, editar: true, asignar: true },
          [modFacId]: { ver: true, crear: true, editar: true, aprobar: false }
        },
        customOverrides: [
          // Override 1: Bloquear asignación de mecánico explícitamente en Taller (denegación prevalece)
          { pantallaId: scrOtId, puede_asignar: false, puede_editar: true },
          // Override 2: Otorgar aprobación explícita en Facturación (concesión prevalece)
          { pantallaId: scrFacId, puede_aprobar: true }
        ]
      },
      {
        key: 'sinpermisos',
        name: 'Usuario sin Permisos',
        username: 'test_p6_sinpermisos',
        email: 'test_p6_sinpermisos@ridelab.test',
        userId: maxU + 107,
        roleId: maxR + 107,
        roleName: 'TEST_ROL_SIN_PERMISOS',
        perms: {
          [scrFacId]: { ver: false },
          [scrOtId]: { ver: false },
          [scrTransId]: { ver: false },
          [scrAjuId]: { ver: false },
          [scrDashId]: { ver: false },
        },
        modPerms: {
          [modFacId]: { ver: false },
          [modTallerId]: { ver: false },
          [modInvId]: { ver: false }
        }
      }
    ];

    const rawPassword = 'BikersTest2026!';
    const hashedPwd = hashPassword(rawPassword);

    console.log('--- 1. CREANDO ROLES Y USUARIOS DE PRUEBA AISLADOS ---');
    for (let i = 0; i < profiles.length; i++) {
      const p = profiles[i];
      cleanupRoles.push(p.roleId);
      cleanupUsers.push(p.userId);

      // Crear rol
      await client.query(`
        INSERT INTO admin.rol_funcional (rol_funcional_id, nombre, estado, fecha_creacion)
        VALUES ($1, $2, 'ACTIVO', NOW())
        ON CONFLICT (rol_funcional_id) DO UPDATE SET nombre = EXCLUDED.nombre, estado = 'ACTIVO'
      `, [p.roleId, p.roleName]);

      // Matriz de permisos para pantallas
      for (const [pId, flags] of Object.entries(p.perms)) {
        if (!pId || pId === 'undefined') continue;
        await client.query(`
          INSERT INTO admin.matriz_acceso_pantalla (
            rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
            puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
            puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
            estado
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'ACTIVO')
          ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET
            puede_ver = EXCLUDED.puede_ver,
            puede_crear = EXCLUDED.puede_crear,
            puede_editar = EXCLUDED.puede_editar,
            puede_inactivar = EXCLUDED.puede_inactivar,
            puede_exportar = EXCLUDED.puede_exportar,
            puede_importar = EXCLUDED.puede_importar,
            puede_aprobar = EXCLUDED.puede_aprobar,
            puede_asignar = EXCLUDED.puede_asignar,
            puede_mover = EXCLUDED.puede_mover,
            puede_cerrar = EXCLUDED.puede_cerrar,
            puede_reabrir = EXCLUDED.puede_reabrir,
            puede_eliminar = EXCLUDED.puede_eliminar,
            estado = 'ACTIVO'
        `, [
          p.roleId, Number(pId),
          Boolean(flags.ver),
          Boolean(flags.crear),
          Boolean(flags.editar),
          Boolean(flags.inactivar),
          Boolean(flags.exportar),
          Boolean(flags.importar),
          Boolean(flags.aprobar),
          Boolean(flags.asignar),
          Boolean(flags.mover),
          Boolean(flags.cerrar),
          Boolean(flags.reabrir),
          Boolean(flags.eliminar)
        ]);
      }

      // Matriz de permisos para módulos (admin.matriz_acceso_rol)
      if (p.modPerms) {
        for (const [mId, mflags] of Object.entries(p.modPerms)) {
          if (!mId || mId === 'undefined') continue;
          await client.query("DELETE FROM admin.matriz_acceso_rol WHERE rol_funcional_id = $1 AND modulo_sistema_id = $2", [p.roleId, Number(mId)]);
          maxMatrizRolId++;
          await client.query(`
            INSERT INTO admin.matriz_acceso_rol (
              matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id, puede_ver, puede_crear, puede_editar,
              puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
              puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar, estado
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'ACTIVO')
          `, [
            maxMatrizRolId,
            p.roleId, Number(mId),
            Boolean(mflags.ver),
            Boolean(mflags.crear),
            Boolean(mflags.editar),
            Boolean(mflags.inactivar),
            Boolean(mflags.exportar),
            Boolean(mflags.importar),
            Boolean(mflags.aprobar),
            Boolean(mflags.asignar),
            Boolean(mflags.mover),
            Boolean(mflags.cerrar),
            Boolean(mflags.reabrir),
            Boolean(mflags.eliminar)
          ]);
        }
      }

      // Crear usuario
      await client.query(`
        INSERT INTO admin.usuario (usuario_id, tipo_usuario_id, empresa_id, rol_principal_id, estado, duracion_sesion_minutos, fecha_creacion)
        VALUES ($1, $2, $3, $4, 'ACTIVO', 480, NOW())
        ON CONFLICT (usuario_id) DO UPDATE SET rol_principal_id = EXCLUDED.rol_principal_id, estado = 'ACTIVO'
      `, [p.userId, tipoUserId, empresaId, p.roleId]);

      // Identidad
      await client.query(`
        INSERT INTO admin.usuario_identidad (usuario_id, nombre, apellido, correo_electronico, fecha_creacion, fecha_actualizacion)
        VALUES ($1, $2, 'Prueba P6', $3, NOW(), NOW())
        ON CONFLICT (usuario_id) DO UPDATE SET correo_electronico = EXCLUDED.correo_electronico
      `, [p.userId, p.name, p.email]);

      // Seguridad con ID explícito
      const segId = maxSeg + i + 1;
      await client.query(`
        INSERT INTO admin.usuario_seguridad (
          usuario_seguridad_id, usuario_id, metodo_acceso_principal, identificador_principal, correo_acceso,
          password, intentos_fallidos, bloqueado_hasta, forzar_cambio_clave, requiere_cambio_clave
        ) VALUES ($1, $2, 'USUARIO', $3, $4, $5, 0, NULL, false, false)
        ON CONFLICT (usuario_seguridad_id) DO UPDATE SET
          identificador_principal = EXCLUDED.identificador_principal,
          password = EXCLUDED.password,
          bloqueado_hasta = NULL,
          intentos_fallidos = 0
      `, [segId, p.userId, p.username, p.email, hashedPwd]);

      // Crear sesión activa
      const rawToken = `ses_p6_${p.key}_${crypto.randomBytes(16).toString('hex')}`;
      const tokenHash = hashSessionToken(rawToken);
      p.rawToken = rawToken;

      await client.query(`
        INSERT INTO admin.usuario_sesion (
          usuario_id, token_identificador, dispositivo_navegador, direccion_ip,
          fecha_inicio, ultima_actividad, fecha_expiracion, estado
        ) VALUES ($1, $2, 'Automated Test Client', '127.0.0.1', NOW(), NOW(), NOW() + INTERVAL '1 day', 'ACTIVA')
      `, [p.userId, tokenHash]);

      // Overrides personalizados si existen
      if (p.customOverrides) {
        for (const ov of p.customOverrides) {
          await client.query(`
            INSERT INTO admin.usuario_permiso_personalizado (
              usuario_id, modulo_sistema_id, pantalla_id, puede_ver, puede_crear, puede_editar,
              puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
              puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
              estado, fecha_creacion
            ) VALUES (
              $1,
              (SELECT modulo_sistema_id FROM admin.pantalla_sistema WHERE pantalla_id = $2),
              $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'ACTIVO', NOW()
            )
            ON CONFLICT (usuario_id, modulo_sistema_id, pantalla_id) DO UPDATE SET
              puede_asignar = COALESCE(EXCLUDED.puede_asignar, admin.usuario_permiso_personalizado.puede_asignar),
              puede_aprobar = COALESCE(EXCLUDED.puede_aprobar, admin.usuario_permiso_personalizado.puede_aprobar),
              estado = 'ACTIVO'
          `, [
            p.userId, ov.pantallaId,
            ov.puede_ver ?? true,
            ov.puede_crear ?? false,
            ov.puede_editar ?? true,
            ov.puede_inactivar ?? false,
            ov.puede_exportar ?? false,
            ov.puede_importar ?? false,
            ov.puede_aprobar ?? false,
            ov.puede_asignar ?? false,
            ov.puede_mover ?? false,
            ov.puede_cerrar ?? false,
            ov.puede_reabrir ?? false,
            ov.puede_eliminar ?? false
          ]);
        }
      }
    }
    console.log(`  [OK] Creados ${profiles.length} perfiles de prueba con sesiones activas.`);

    // 3. Crear registros auxiliares de prueba para órdenes y facturas en admin.ordenes_trabajo y admin.facturas
    console.log('\n--- 2. CREANDO REGISTROS DE PRUEBA AUXILIARES ---');

    // Descubrir motivo de anulación válido activo
    const mafCatRes = await client.query("SELECT motivo_anulacion_factura_id FROM admin.motivo_anulacion_factura WHERE estado = 'ACTIVO' ORDER BY motivo_anulacion_factura_id LIMIT 1");
    const validMotivoId = mafCatRes.rows[0]?.motivo_anulacion_factura_id || 1;

    // Crear orden con subtotales y total > 0 (Regla de negocio: la factura requiere total > 0)
    const otIns = await client.query(`
      INSERT INTO admin.ordenes_trabajo (
        codigo_orden, recepcion_id, cliente_id, bicicleta_id,
        estado_orden_id, prioridad_orden_id, descripcion_cliente, diagnostico_inicial,
        fecha_recepcion, subtotal_servicios, subtotal_productos, descuento_servicios,
        descuento_productos, subtotal_general, impuesto, total_orden, activo, fecha_registro, facturado
      ) VALUES (
        'TEST-P6-OT-001', $1, $2, $3,
        1, 1, 'Orden de prueba Fase 6', 'Diagnóstico test base',
        NOW(), 500, 0, 0, 0, 500, 0, 500, true, NOW(), false
      ) RETURNING orden_trabajo_id
    `, [recId, cliId, bikeId]);
    const testOtId = otIns.rows[0].orden_trabajo_id;
    cleanupWorkOrders.push(testOtId);

    // Insertar servicio facturable activo en admin.orden_servicios
    const srvTypeRes = await client.query("SELECT tipo_servicio_id FROM admin.tipo_servicio WHERE activo = true LIMIT 1");
    const tipoServicioId = srvTypeRes.rows[0]?.tipo_servicio_id || 1;

    await client.query(`
      INSERT INTO admin.orden_servicios (
        orden_trabajo_id, codigo_servicio, tipo_servicio_id, estado_orden_servicio_id,
        estado_aprobacion_id, secuencia, cantidad, precio_unitario, porcentaje_descuento,
        valor_descuento, subtotal, observacion_tecnica, activo, fecha_registro
      ) VALUES (
        $1, 'SRV-TEST-P6', $2, 1,
        1, 1, 1, 500.00, 0,
        0, 500.00, 'Servicio facturable de prueba Fase 6', true, NOW()
      )
    `, [testOtId, tipoServicioId]);

    const facIns = await client.query(`
      INSERT INTO admin.facturas (
        factura_id, empresa_id, tipo_factura_id, cliente_id, numero_factura,
        codigo_factura, fecha_factura, subtotal, descuento_total, impuesto_total,
        total_factura, monto_pagado, balance_pendiente, estado, fecha_registro, condicion_venta
      ) VALUES (
        (SELECT COALESCE(MAX(factura_id), 0) + 1 FROM admin.facturas),
        $1, 1, $2, 'TEST-P6-FAC-001',
        'TEST-P6-FAC-001', NOW(), 1000, 0, 180,
        1180, 0, 1180, 'EMITIDA', NOW(), 'CONTADO'
      ) RETURNING factura_id
    `, [empresaId, cliId]);
    const testFacId = facIns.rows[0].factura_id;
    cleanupInvoices.push(testFacId);
    console.log(`  [OK] Creada OT de prueba #${testOtId} (con servicio RD$ 500.00) y Factura de prueba #${testFacId}.`);

    // Helper para realizar peticiones HTTP autenticadas con session_token y timeout explícito
    async function apiRequest(profile, method, path, body = null, timeoutMs = 12000) {
      const url = `${BASE_URL}${path}`;
      const headers = {
        'Cookie': `session_token=${profile.rawToken}; session_user_id=${profile.userId}`,
        'Content-Type': 'application/json'
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const opts = { method, headers, signal: controller.signal };
      if (body) opts.body = JSON.stringify(body);

      try {
        const res = await fetch(url, opts);
        clearTimeout(timer);
        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        return { status: res.status, ok: res.ok, headers: res.headers, data };
      } catch (err) {
        clearTimeout(timer);
        const isTimeout = err.name === 'AbortError' || String(err.message || '').includes('aborted');
        const errorDesc = isTimeout ? `Timeout excedido (${timeoutMs}ms)` : err.message;
        return { status: 0, ok: false, error: errorDesc, isTimeout };
      }
    }

    // ========================================================
    // EJECUCIÓN DE PRUEBAS POR PERFIL
    // ========================================================

    // PERFIL 1: SOLO LECTURA
    console.log('\n--- PERFIL 1: SOLO LECTURA ---');
    const p1 = profiles.find(p => p.key === 'readonly');
    const p1Me = await apiRequest(p1, 'GET', '/api/auth/me');
    assert(p1Me.status === 200 && p1Me.data?.success, 'P1: Autenticación exitosa en /api/auth/me');
    assert(p1Me.data?.user?.rol === 'TEST_ROL_SOLO_LECTURA', 'P1: Rol funcional correcto en sesión');

    const p1Dash = await apiRequest(p1, 'GET', '/api/dashboard');
    assert(p1Dash.status === 403, 'P1: Dashboard DENEGADO para solo lectura (HTTP 403 Forbidden)', `Status: ${p1Dash.status}`);

    const p1FacGet = await apiRequest(p1, 'GET', '/api/facturacion/facturas');
    assert(p1FacGet.status === 200, 'P1: Consulta de facturas permitida (HTTP 200)');

    const p1FacPost = await apiRequest(p1, 'POST', '/api/facturacion/facturas', { total: 100 });
    assert(p1FacPost.status === 403, 'P1: Creación de factura DENEGADA (HTTP 403 Forbidden)', `Status: ${p1FacPost.status}`);

    const p1FacAnular = await apiRequest(p1, 'POST', `/api/facturacion/facturas/${testFacId}/anular`, {
      motivo_anulacion_factura_id: validMotivoId,
      motivo_id: validMotivoId
    });
    assert(p1FacAnular.status === 403, 'P1: Anulación de factura DENEGADA (HTTP 403 Forbidden)', `Status: ${p1FacAnular.status}${p1FacAnular.error ? ` (${p1FacAnular.error})` : ''}`);

    const p1TransPost = await apiRequest(p1, 'POST', '/api/inventario/transferencias', { almacen_origen_id: 1, almacen_destino_id: 2 });
    assert(p1TransPost.status === 403, 'P1: Transferencia de inventario DENEGADA (HTTP 403 Forbidden)', `Status: ${p1TransPost.status}`);

    const p1AjuPost = await apiRequest(p1, 'POST', '/api/inventario/ajustes', { tipo: 'AJU_POS', almacenId: 1 });
    assert(p1AjuPost.status === 403, 'P1: Ajuste de inventario DENEGADO (HTTP 403 Forbidden)', `Status: ${p1AjuPost.status}`);

    const p1OtPut = await apiRequest(p1, 'PUT', `/api/taller/ordenes/${testOtId}`, { diagnostico_inicial: 'Nuevo diagnostico' });
    assert(p1OtPut.status === 403, 'P1: Modificación de OT DENEGADA (HTTP 403 Forbidden)', `Status: ${p1OtPut.status}`);


    // PERFIL 2: OPERADOR DE TALLER
    console.log('\n--- PERFIL 2: OPERADOR DE TALLER ---');
    const p2 = profiles.find(p => p.key === 'taller');
    const p2Me = await apiRequest(p2, 'GET', '/api/auth/me');
    assert(p2Me.status === 200, 'P2: Autenticación exitosa en /api/auth/me');

    const p2OtGet = await apiRequest(p2, 'GET', `/api/taller/ordenes/${testOtId}`);
    assert(p2OtGet.status === 200, 'P2: Consulta de órdenes de trabajo AUTORIZADA (HTTP 200)');
    assert(p2OtGet.headers.get('x-perm-asignar') === 'false', 'P2: Header x-perm-asignar indica false');
    assert(p2OtGet.headers.get('x-perm-cerrar') === 'false', 'P2: Header x-perm-cerrar indica false');

    // Modificar diagnóstico (EDITAR) -> AUTORIZADO
    const p2OtEdit = await apiRequest(p2, 'PUT', `/api/taller/ordenes/${testOtId}`, { diagnostico_inicial: 'Diagnóstico por operador de taller' });
    assert(p2OtEdit.status === 200, 'P2: Edición de diagnóstico general AUTORIZADA (HTTP 200)');

    // Asignar mecánico -> DENEGADO (HTTP 403)
    const p2OtAsignar = await apiRequest(p2, 'PUT', `/api/taller/ordenes/${testOtId}`, { mecanico_id: 99 });
    assert(p2OtAsignar.status === 403, 'P2: Asignación de mecánico DENEGADA (HTTP 403 Forbidden)');

    // Entregar / Cerrar orden (estado 8: ENTREGADA) sin privilegio puede_cerrar -> DENEGADO (HTTP 403)
    const p2OtCerrar = await apiRequest(p2, 'PUT', `/api/taller/ordenes/${testOtId}`, { estado_orden_id: 8 });
    assert(p2OtCerrar.status === 403, 'P2: Cierre de orden ENTREGADA DENEGADO (HTTP 403 Forbidden)');

    // Reabrir orden sin privilegio puede_reabrir -> DENEGADO (HTTP 403)
    const p2OtReabrir = await apiRequest(p2, 'PUT', `/api/taller/ordenes/${testOtId}`, { accion: 'REABRIR_REPARACION' });
    assert(p2OtReabrir.status === 403, 'P2: Reapertura de orden DENEGADA (HTTP 403 Forbidden)');

    // Eliminar producto de la orden -> DENEGADO
    const p2OtDelProd = await apiRequest(p2, 'DELETE', `/api/taller/ordenes/${testOtId}/productos/999`);
    assert(p2OtDelProd.status === 403, 'P2: Eliminación de repuesto en OT DENEGADA (HTTP 403 Forbidden)');

    // Intento de facturar -> DENEGADO
    const p2FacPost = await apiRequest(p2, 'POST', '/api/facturacion/facturas', { total: 500 });
    assert(p2FacPost.status === 403, 'P2: Operaciones de facturación DENEGADAS (HTTP 403 Forbidden)');


    // PERFIL 3: SUPERVISOR
    console.log('\n--- PERFIL 3: SUPERVISOR ---');
    const p3 = profiles.find(p => p.key === 'supervisor');
    const p3Me = await apiRequest(p3, 'GET', '/api/auth/me');
    assert(p3Me.status === 200, 'P3: Autenticación exitosa en /api/auth/me');

    const p3OtGet = await apiRequest(p3, 'GET', `/api/taller/ordenes/${testOtId}`);
    assert(p3OtGet.headers.get('x-perm-asignar') === 'true', 'P3: Header x-perm-asignar indica true para supervisor');
    assert(p3OtGet.headers.get('x-perm-cerrar') === 'true', 'P3: Header x-perm-cerrar indica true para supervisor');

    // Supervisor asigna mecánico -> AUTORIZADO
    const p3OtAsignar = await apiRequest(p3, 'PUT', `/api/taller/ordenes/${testOtId}`, { mecanico_id: null, diagnostico_inicial: 'Asignado por supervisor' });
    assert(p3OtAsignar.status === 200, 'P3: Asignación de mecánico AUTORIZADA (HTTP 200)');

    // Para probar cierre (ENTREGADA), preparar la orden en estado 7 (LISTA_ENTREGA)
    await client.query("UPDATE admin.ordenes_trabajo SET estado_orden_id = 7 WHERE orden_trabajo_id = $1", [testOtId]);

    // Supervisor cierra orden (ENTREGADA) -> AUTORIZADO
    const p3OtCerrar = await apiRequest(p3, 'PUT', `/api/taller/ordenes/${testOtId}`, { estado_orden_id: 8 });
    assert(p3OtCerrar.status === 200, 'P3: Cierre de orden (ENTREGADA) AUTORIZADO (HTTP 200)');

    // Supervisor anula factura -> AUTORIZADO
    const p3FacAnular = await apiRequest(p3, 'POST', `/api/facturacion/facturas/${testFacId}/anular`, {
      motivo_anulacion_factura_id: validMotivoId,
      motivo_id: validMotivoId,
      observacion: 'Anulado por supervisor en prueba de Fase 6'
    });
    assert(p3FacAnular.status === 200, 'P3: Anulación de factura AUTORIZADA por privilegio APROBAR (HTTP 200)', `Status: ${p3FacAnular.status}${p3FacAnular.error ? ` (${p3FacAnular.error})` : ''}`);


    // PERFIL 4: ENCARGADO DE INVENTARIO
    console.log('\n--- PERFIL 4: ENCARGADO DE INVENTARIO ---');
    const p4 = profiles.find(p => p.key === 'inventario');
    const p4Me = await apiRequest(p4, 'GET', '/api/auth/me');
    assert(p4Me.status === 200, 'P4: Autenticación exitosa en /api/auth/me');

    const p4TransGet = await apiRequest(p4, 'GET', '/api/inventario/transferencias');
    assert(p4TransGet.status === 200, 'P4: Consulta de transferencias AUTORIZADA (HTTP 200)');
    assert(p4TransGet.data?.permisos?.puede_mover === true, 'P4: Permiso puede_mover expuesto en body');

    // Transferencia con privilegio puede_mover -> AUTORIZADO (o validación de negocio, no 403)
    const p4TransPost = await apiRequest(p4, 'POST', '/api/inventario/transferencias', {
      almacen_origen_id: 1,
      almacen_destino_id: 2,
      detalles: []
    });
    assert(p4TransPost.status !== 403, 'P4: Registro de transferencia no denegado por autorización (HTTP != 403)');

    // Ajuste Positivo (AJU_POS) requiere APROBAR -> DENEGADO (HTTP 403)
    const p4AjuPos = await apiRequest(p4, 'POST', '/api/inventario/ajustes', {
      tipo: 'AJU_POS',
      almacenId: 1,
      motivo: 'Prueba sin aprobar'
    });
    assert(p4AjuPos.status === 403, 'P4: Ajuste Positivo (AJU_POS) DENEGADO sin privilegio APROBAR (HTTP 403)');

    // Intento en taller -> DENEGADO
    const p4OtPut = await apiRequest(p4, 'PUT', `/api/taller/ordenes/${testOtId}`, { diagnostico_inicial: 'Test' });
    assert(p4OtPut.status === 403, 'P4: Acceso a órdenes de taller DENEGADO (HTTP 403)');


    // PERFIL 5: ENCARGADO DE FACTURACIÓN
    console.log('\n--- PERFIL 5: ENCARGADO DE FACTURACIÓN ---');
    const p5 = profiles.find(p => p.key === 'facturacion');
    const p5Me = await apiRequest(p5, 'GET', '/api/auth/me');
    assert(p5Me.status === 200, 'P5: Autenticación exitosa en /api/auth/me');

    const p5FacGet = await apiRequest(p5, 'GET', '/api/facturacion/facturas');
    assert(p5FacGet.status === 200, 'P5: Consulta de facturas AUTORIZADA (HTTP 200)');

    // Editar términos (EDITAR) -> AUTORIZADO (HTTP 200)
    // Crear una factura auxiliar limpia para P5 no anulada
    const facP5Ins = await client.query(`
      INSERT INTO admin.facturas (
        factura_id, empresa_id, tipo_factura_id, cliente_id, numero_factura,
        codigo_factura, fecha_factura, subtotal, descuento_total, impuesto_total,
        total_factura, monto_pagado, balance_pendiente, estado, fecha_registro, condicion_venta
      ) VALUES (
        (SELECT COALESCE(MAX(factura_id), 0) + 1 FROM admin.facturas),
        $1, 1, $2, 'TEST-FAC-P5',
        'TEST-P6-FAC-002', NOW(), 500, 0, 90,
        590, 0, 590, 'EMITIDA', NOW(), 'CONTADO'
      ) RETURNING factura_id
    `, [empresaId, cliId]);
    const testFacP5Id = facP5Ins.rows[0].factura_id;
    cleanupInvoices.push(testFacP5Id);

    const p5FacPatch = await apiRequest(p5, 'PATCH', `/api/facturacion/facturas/${testFacP5Id}`, {
      condicion_venta: 'CREDITO'
    });
    assert(p5FacPatch.status === 200, 'P5: Modificación de términos AUTORIZADA por privilegio EDITAR (HTTP 200)');

    // Anular factura (requiere APROBAR) -> DENEGADO
    const p5FacAnular = await apiRequest(p5, 'POST', `/api/facturacion/facturas/${testFacP5Id}/anular`, {
      motivo_anulacion_factura_id: validMotivoId,
      motivo_id: validMotivoId
    });
    assert(p5FacAnular.status === 403, 'P5: Anulación de factura DENEGADA para encargado de facturación sin APROBAR (HTTP 403)', `Status: ${p5FacAnular.status}${p5FacAnular.error ? ` (${p5FacAnular.error})` : ''}`);

    // Intento de transferencias de inventario -> DENEGADO
    const p5TransPost = await apiRequest(p5, 'POST', '/api/inventario/transferencias', { almacen_origen_id: 1, almacen_destino_id: 2 });
    assert(p5TransPost.status === 403, 'P5: Transferencias de almacén DENEGADAS (HTTP 403)');


    // PERFIL 6: USUARIO CON PERMISOS PERSONALIZADOS
    console.log('\n--- PERFIL 6: USUARIO CON PERMISOS PERSONALIZADOS ---');
    const p6 = profiles.find(p => p.key === 'personalizado');
    const p6Me = await apiRequest(p6, 'GET', '/api/auth/me');
    assert(p6Me.status === 200, 'P6: Autenticación exitosa en /api/auth/me');

    // Su rol base permitía ASIGNAR, pero la excepción personalizada DENEGÓ puede_asignar = false
    const p6OtAsignar = await apiRequest(p6, 'PUT', `/api/taller/ordenes/${testOtId}`, { mecanico_id: 1 });
    assert(p6OtAsignar.status === 403, 'P6: Denegación personalizada prevalece: Asignar mecánico DENEGADO (HTTP 403)');

    // Su rol base denegaba APROBAR en facturas, pero la excepción personalizada CONCEDIÓ puede_aprobar = true
    const p6FacAnular = await apiRequest(p6, 'POST', `/api/facturacion/facturas/${testFacP5Id}/anular`, {
      motivo_anulacion_factura_id: validMotivoId,
      motivo_id: validMotivoId,
      observacion: 'Anulado con excepción personalizada'
    });
    assert(p6FacAnular.status === 200, 'P6: Concesión personalizada prevalece: Anular factura AUTORIZADO (HTTP 200)', `Status: ${p6FacAnular.status}${p6FacAnular.error ? ` (${p6FacAnular.error})` : ''}`);


    // PERFIL 7: USUARIO SIN PERMISOS
    console.log('\n--- PERFIL 7: USUARIO SIN PERMISOS ---');
    const p7 = profiles.find(p => p.key === 'sinpermisos');
    const p7Me = await apiRequest(p7, 'GET', '/api/auth/me');
    assert(p7Me.status === 200, 'P7: Login e identidad válidos en /api/auth/me (HTTP 200)');

    const p7Dash = await apiRequest(p7, 'GET', '/api/dashboard');
    assert(p7Dash.status === 403, 'P7: Dashboard DENEGADO (HTTP 403 Forbidden)');

    const p7Fac = await apiRequest(p7, 'GET', '/api/facturacion/facturas');
    assert(p7Fac.status === 403, 'P7: Facturación DENEGADA (HTTP 403 Forbidden)');

    const p7Ot = await apiRequest(p7, 'GET', '/api/taller/ordenes');
    assert(p7Ot.status === 403, 'P7: Taller DENEGADO (HTTP 403 Forbidden)');

    const p7Trans = await apiRequest(p7, 'GET', '/api/inventario/transferencias');
    assert(p7Trans.status === 403, 'P7: Inventario DENEGADO (HTTP 403 Forbidden)');


    // PRUEBA DINÁMICA: ACTUALIZACIÓN TRAS CAMBIO DE ROL
    console.log('\n--- PRUEBA DINÁMICA: ACTUALIZACIÓN DE PERMISOS TRAS CAMBIO DE ROL ---');
    // Para el usuario Solo Lectura (P1), concedemos dinámicamente puede_editar = true en Taller
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla
      SET puede_editar = true
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [p1.roleId, scrOtId]);

    const p1DynEdit1 = await apiRequest(p1, 'PUT', `/api/taller/ordenes/${testOtId}`, { diagnostico_inicial: 'Dinámicamente editado' });
    assert(p1DynEdit1.status === 200, 'Dinámico: Tras otorgar privilegio al rol, petición inmediata es AUTORIZADA (HTTP 200)');

    // Revocamos nuevamente
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla
      SET puede_editar = false
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [p1.roleId, scrOtId]);

    const p1DynEdit2 = await apiRequest(p1, 'PUT', `/api/taller/ordenes/${testOtId}`, { diagnostico_inicial: 'Intento post-revocación' });
    assert(p1DynEdit2.status === 403, 'Dinámico: Tras revocar privilegio al rol, petición inmediata es DENEGADA (HTTP 403)');

  } catch (err) {
    console.error('Error durante la ejecución de Fase 6:', err);
    assert(false, 'Ejecución de Fase 6 completada sin excepciones no controladas', err.message);
  } finally {
    // LIMPIEZA TOTAL DE REGISTROS DE PRUEBA EN ORDEN ESTRICTO DE INTEGRIDAD REFERENCIAL
    console.log('\n--- 3. LIMPIEZA DE DATOS DE PRUEBA (CERO RESIDUOS) ---');
    try {
      // 1. Descubrir facturas creadas automáticamente por la entrega de órdenes
      if (cleanupWorkOrders.length > 0) {
        const autoInvoicesRes = await client.query(
          "SELECT factura_id FROM admin.facturas WHERE orden_trabajo_id = ANY($1::int[])",
          [cleanupWorkOrders]
        );
        for (const row of autoInvoicesRes.rows) {
          if (!cleanupInvoices.includes(row.factura_id)) {
            cleanupInvoices.push(row.factura_id);
          }
        }
      }

      // 2. Limpiar facturas y registros asociados
      if (cleanupInvoices.length > 0) {
        await client.query("DELETE FROM admin.factura_anulacion WHERE factura_id = ANY($1::int[])", [cleanupInvoices]);
        await client.query("DELETE FROM admin.pagos WHERE factura_id = ANY($1::int[])", [cleanupInvoices]);
        await client.query("DELETE FROM admin.detalle_factura WHERE factura_id = ANY($1::int[])", [cleanupInvoices]);
        await client.query("DELETE FROM admin.facturas WHERE factura_id = ANY($1::int[])", [cleanupInvoices]);
      }

      // 3. Limpiar órdenes de trabajo e hijos
      if (cleanupWorkOrders.length > 0) {
        await client.query("DELETE FROM admin.orden_historial WHERE orden_trabajo_id = ANY($1::int[])", [cleanupWorkOrders]);
        await client.query("DELETE FROM admin.orden_servicios WHERE orden_trabajo_id = ANY($1::int[])", [cleanupWorkOrders]);
        await client.query("DELETE FROM admin.orden_productos WHERE orden_trabajo_id = ANY($1::int[])", [cleanupWorkOrders]);
        await client.query("DELETE FROM admin.ordenes_trabajo WHERE orden_trabajo_id = ANY($1::int[])", [cleanupWorkOrders]);
      }

      // 4. Limpiar usuarios sintéticos en orden de claves foráneas
      if (cleanupUsers.length > 0) {
        await client.query("DELETE FROM admin.factura_anulacion WHERE usuario_anulacion_id = ANY($1::int[]) OR usuario_autorizacion_id = ANY($1::int[])", [cleanupUsers]);
        await client.query("DELETE FROM admin.usuario_actividad WHERE usuario_id = ANY($1::int[])", [cleanupUsers]);
        await client.query("DELETE FROM admin.usuario_auditoria WHERE usuario_id = ANY($1::int[]) OR admin_id = ANY($1::int[])", [cleanupUsers]);
        await client.query("DELETE FROM admin.usuario_sesion WHERE usuario_id = ANY($1::int[]) OR revocado_por = ANY($1::int[])", [cleanupUsers]);
        await client.query("DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = ANY($1::int[])", [cleanupUsers]);
        await client.query("DELETE FROM admin.usuario_rol_adicional WHERE usuario_id = ANY($1::int[])", [cleanupUsers]);
        await client.query("DELETE FROM admin.usuario_seguridad WHERE usuario_id = ANY($1::int[])", [cleanupUsers]);
        await client.query("DELETE FROM admin.usuario_identidad WHERE usuario_id = ANY($1::int[])", [cleanupUsers]);
        await client.query("DELETE FROM admin.usuario_alcance WHERE usuario_id = ANY($1::int[])", [cleanupUsers]);
        await client.query("DELETE FROM admin.usuario_configuracion_acceso WHERE usuario_id = ANY($1::int[])", [cleanupUsers]);
        await client.query("DELETE FROM admin.usuario WHERE usuario_id = ANY($1::int[])", [cleanupUsers]);
      }

      // 5. Limpiar roles sintéticos
      if (cleanupRoles.length > 0) {
        await client.query("DELETE FROM admin.matriz_acceso_rol WHERE rol_funcional_id = ANY($1::int[])", [cleanupRoles]);
        await client.query("DELETE FROM admin.matriz_acceso_pantalla WHERE rol_funcional_id = ANY($1::int[])", [cleanupRoles]);
        await client.query("DELETE FROM admin.rol_funcional WHERE rol_funcional_id = ANY($1::int[])", [cleanupRoles]);
      }
      console.log('  [OK] Todos los registros de prueba (usuarios, sesiones, roles, facturas, órdenes) fueron eliminados exitosamente.');
    } catch (cleanupErr) {
      console.error('Error durante la limpieza de datos de prueba:', cleanupErr);
    } finally {
      client.release();
      await pool.end();
    }
  }

  console.log('\n========================================================');
  console.log(`RESUMEN FASE 6: ${passedCount} Pasadas, ${failedCount} Falladas de ${passedCount + failedCount} Pruebas`);
  console.log(failedCount === 0 ? 'Resultado Final: CERTIFICACION_FASE_6_EXITOSA' : 'Resultado Final: FALLOS_DETECTADOS');
  console.log('========================================================\n');

  process.exit(failedCount === 0 ? 0 : 1);
}

runPhase6Tests();
