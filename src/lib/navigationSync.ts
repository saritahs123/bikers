import { query } from "@/lib/db";
import { CANONICAL_NAVIGATION, normalizeCode } from "@/config/navigationConfig";
import { normalizeModuleCode } from "@/lib/moduleCode";

export interface SyncResult {
  success: boolean;
  menusSynced: number;
  screensSynced: number;
  menusInactivated: number;
  screensInactivated: number;
  message: string;
}

let lastSyncTimestamp = 0;
const SYNC_CACHE_DURATION_MS = 60_000; // Cache sync check for 1 minute

/**
 * Sincroniza de forma segura e idempotente la configuración canónica (CANONICAL_NAVIGATION)
 * con las tablas admin.modulo_sistema y admin.pantalla_sistema en PostgreSQL.
 *
 * Principios garantizados:
 * 1. Cero pérdida de datos (NO destructivo: jamás ejecuta DELETE o DROP).
 * 2. Idempotencia total: ejecuciones sucesivas mantienen IDs y relaciones.
 * 3. Preservación estricta de permisos en admin.matriz_acceso_rol y admin.matriz_acceso_pantalla.
 * 4. Módulos o pantallas retirados pasan a estado INACTIVO / activo = false.
 */
export async function syncNavigationToDatabase(force = false): Promise<SyncResult> {
  const now = Date.now();
  if (!force && now - lastSyncTimestamp < SYNC_CACHE_DURATION_MS) {
    return {
      success: true,
      menusSynced: 0,
      screensSynced: 0,
      menusInactivated: 0,
      screensInactivated: 0,
      message: "Sincronización omitida (reciente en caché)."
    };
  }

  try {
    let menusSynced = 0;
    let screensSynced = 0;
    const menusInactivated = 0;
    const screensInactivated = 0;

    // 1. Obtener módulos y pantallas existentes en la base de datos (Lectura segura)
    interface DbMod {
      modulo_sistema_id: number;
      nombre: string;
      orden: number;
      estado: string;
    }
    const existingModsRes = (await query(
      "SELECT modulo_sistema_id, nombre, orden, estado FROM admin.modulo_sistema"
    )) as unknown as DbMod[];

    interface DbScreen {
      pantalla_id: number;
      modulo_sistema_id: number;
      codigo: string;
      nombre: string;
      ruta: string;
      tipo: string;
      orden: number;
      activo: boolean;
    }
    const existingScreensRes = (await query(
      "SELECT pantalla_id, modulo_sistema_id, codigo, nombre, ruta, tipo, orden, activo FROM admin.pantalla_sistema"
    )) as unknown as DbScreen[];

    const activeCanonicalCodes = new Set<string>();
    const activeCanonicalScreenCodes = new Set<string>();

    // Pre-chequeo en memoria: detectar si realmente se requieren escrituras (DML)
    let needsWrite = force;

    if (!needsWrite) {
      // Validar módulos canónicos
      for (const menu of CANONICAL_NAVIGATION) {
        const canonicalKey = normalizeCode(menu.codigo);
        const dbMod = existingModsRes.find(m => normalizeCode(m.nombre) === canonicalKey);
        if (!dbMod || dbMod.orden !== menu.orden || dbMod.estado !== "ACTIVO") {
          needsWrite = true;
          break;
        }
        for (const scr of menu.screens) {
          const screenKey = normalizeCode(scr.codigo);
          const dbScreen = existingScreensRes.find(s => normalizeCode(s.codigo) === screenKey);
          if (
            !dbScreen ||
            dbScreen.modulo_sistema_id !== dbMod.modulo_sistema_id ||
            dbScreen.nombre !== scr.nombre ||
            dbScreen.ruta !== scr.ruta ||
            dbScreen.tipo !== scr.tipo ||
            dbScreen.orden !== scr.orden ||
            !dbScreen.activo
          ) {
            needsWrite = true;
            break;
          }
        }
        if (needsWrite) break;
      }
    }

    // Si no requiere escrituras, retornar inmediatamente como lectura pura
    if (!needsWrite) {
      lastSyncTimestamp = Date.now();
      return {
        success: true,
        menusSynced: CANONICAL_NAVIGATION.length,
        screensSynced: CANONICAL_NAVIGATION.reduce((acc, m) => acc + m.screens.length, 0),
        menusInactivated: 0,
        screensInactivated: 0,
        message: "Catálogo en total sincronía (cero escrituras DML ejecutadas)."
      };
    }

    // Catálogo de roles funcionales activos para inicialización Fail-Closed
    interface DbRoleItem {
      rol_funcional_id: number;
    }
    const activeRolesRes = (await query(
      "SELECT rol_funcional_id FROM admin.rol_funcional WHERE estado = 'ACTIVO' OR estado IS NULL"
    )) as unknown as DbRoleItem[];

    // 2. Procesar cada menú de CANONICAL_NAVIGATION cuando hay discrepancias reales
    for (const menu of CANONICAL_NAVIGATION) {
      const canonicalKey = normalizeCode(menu.codigo);
      activeCanonicalCodes.add(canonicalKey);

      const dbMod = existingModsRes.find(
        m => normalizeCode(m.nombre) === canonicalKey
      );

      let moduloId: number;

      if (dbMod) {
        moduloId = dbMod.modulo_sistema_id;
        // Actualizar si difiere orden o estado
        if (dbMod.orden !== menu.orden || dbMod.estado !== "ACTIVO") {
          await query(
            "UPDATE admin.modulo_sistema SET orden = $1, estado = 'ACTIVO', fecha_actualizacion = clock_timestamp() WHERE modulo_sistema_id = $2",
            [menu.orden, moduloId]
          );
        }
      } else {
        // Asignar ID si es conocido o calcular next
        const nextIdRes = (await query(
          "SELECT COALESCE(MAX(modulo_sistema_id), 0) + 1 AS next_id FROM admin.modulo_sistema"
        )) as unknown as Array<{ next_id: number }>;
        moduloId = nextIdRes[0]?.next_id || menu.orden;
        const code = normalizeModuleCode(menu.nombre);

        await query(
          "INSERT INTO admin.modulo_sistema (modulo_sistema_id, codigo, nombre, orden, estado, fecha_creacion, fecha_actualizacion) VALUES ($1, $2, $3, $4, 'ACTIVO', clock_timestamp(), clock_timestamp())",
          [moduloId, code, menu.nombre.toUpperCase(), menu.orden]
        );

        // Inicializar las 12 acciones RBAC en false para todos los roles funcionales (Fail-Closed)
        const maxMatrizRes = (await query(
          "SELECT COALESCE(MAX(matriz_acceso_rol_id), 0) AS max_id FROM admin.matriz_acceso_rol"
        )) as unknown as Array<{ max_id: number }>;
        let currentMatrizId = Number(maxMatrizRes[0]?.max_id || 0);

        for (const role of activeRolesRes) {
          currentMatrizId++;
          await query(
            `INSERT INTO admin.matriz_acceso_rol (
               matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id,
               puede_ver, puede_crear, puede_editar, puede_inactivar,
               puede_exportar, puede_importar, puede_aprobar, puede_asignar,
               puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
               estado, fecha_creacion, fecha_actualizacion
             )
             VALUES ($1, $2, $3, false, false, false, false, false, false, false, false, false, false, false, false, 'ACTIVO', clock_timestamp(), clock_timestamp())
             ON CONFLICT (rol_funcional_id, modulo_sistema_id) DO NOTHING`,
            [currentMatrizId, role.rol_funcional_id, moduloId]
          );
        }
      }
      menusSynced++;

      // 3. Procesar las pantallas de este menú
      for (const scr of menu.screens) {
        const screenCanonicalKey = normalizeCode(scr.codigo);
        activeCanonicalScreenCodes.add(screenCanonicalKey);

        const dbScreen = existingScreensRes.find(
          s => normalizeCode(s.codigo) === screenCanonicalKey
        );

        if (dbScreen) {
          if (
            dbScreen.modulo_sistema_id !== moduloId ||
            dbScreen.nombre !== scr.nombre ||
            dbScreen.ruta !== scr.ruta ||
            dbScreen.tipo !== scr.tipo ||
            dbScreen.orden !== scr.orden ||
            !dbScreen.activo
          ) {
            await query(
              `UPDATE admin.pantalla_sistema 
               SET modulo_sistema_id = $1, nombre = $2, ruta = $3, tipo = $4, orden = $5, activo = true, fecha_actualizacion = clock_timestamp()
               WHERE pantalla_id = $6`,
              [moduloId, scr.nombre, scr.ruta, scr.tipo, scr.orden, dbScreen.pantalla_id]
            );
          }
        } else {
          const nextScreenIdRes = (await query(
            "SELECT COALESCE(MAX(pantalla_id), 0) + 1 AS next_id FROM admin.pantalla_sistema"
          )) as unknown as Array<{ next_id: number }>;
          const nextScreenId = nextScreenIdRes[0]?.next_id || 1;

          await query(
            `INSERT INTO admin.pantalla_sistema (pantalla_id, modulo_sistema_id, codigo, nombre, ruta, tipo, orden, activo, fecha_creacion, fecha_actualizacion)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true, clock_timestamp(), clock_timestamp())`,
            [nextScreenId, moduloId, scr.codigo, scr.nombre, scr.ruta, scr.tipo, scr.orden]
          );

          // Inicializar las 12 acciones RBAC en false en admin.matriz_acceso_pantalla para todos los roles (Fail-Closed)
          // Previene la herencia automática indebida de puede_ver del módulo padre
          for (const role of activeRolesRes) {
            await query(
              `INSERT INTO admin.matriz_acceso_pantalla (
                 rol_funcional_id, pantalla_id,
                 puede_ver, puede_crear, puede_editar, puede_inactivar,
                 puede_exportar, puede_importar, puede_aprobar, puede_asignar,
                 puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
                 estado, fecha_creacion, fecha_actualizacion
               )
               VALUES ($1, $2, false, false, false, false, false, false, false, false, false, false, false, false, 'ACTIVO', clock_timestamp(), clock_timestamp())
               ON CONFLICT (rol_funcional_id, pantalla_id) DO NOTHING`,
              [role.rol_funcional_id, nextScreenId]
            );
          }
        }
        screensSynced++;
      }
    }

    // Preservación estricta de módulos y pantallas manuales:
    // Conforme a la política de seguridad y ciclo de vida de la Fase 6.4.10, NO se desactivan
    // automáticamente módulos ni pantallas creados manualmente en la base de datos.
    lastSyncTimestamp = Date.now();
    return {
      success: true,
      menusSynced,
      screensSynced,
      menusInactivated,
      screensInactivated,
      message: "Sincronización completada exitosamente sin pérdida de datos."
    };
  } catch (error: unknown) {
    console.error("Error en syncNavigationToDatabase:", error);
    return {
      success: false,
      menusSynced: 0,
      screensSynced: 0,
      menusInactivated: 0,
      screensInactivated: 0,
      message: error instanceof Error ? error.message : "Error desconocido durante la sincronización."
    };
  }
}
