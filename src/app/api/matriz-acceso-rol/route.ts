import { NextResponse } from "next/server";
import { getPool, query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { CANONICAL_NAVIGATION, normalizeCode } from "@/config/navigationConfig";
import { normalizeModuleCode, isValidModuleCode } from "@/lib/moduleCode";

interface DbModuloRow {
  id: number;
  label: string;
  orden: number;
  estado: string;
}

interface DbPantallaRow {
  id: number;
  modulo_sistema_id: number;
  codigo: string;
  label: string;
  ruta: string;
  tipo: string;
  orden: number;
  activo: boolean;
}

interface DbRoleRow {
  numericId: number;
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: string;
}

interface DbMatrizRow {
  rol_funcional_id: number;
  modulo_sistema_id: number;
  puede_ver: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
  puede_inactivar: boolean;
  puede_exportar: boolean;
  puede_importar: boolean;
  puede_aprobar: boolean;
  puede_asignar: boolean;
  puede_mover: boolean;
  puede_cerrar: boolean;
  puede_reabrir: boolean;
  puede_eliminar: boolean;
}

interface DbPantallaMatrizRow {
  rol_funcional_id: number;
  pantalla_id: number;
  puede_ver: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
  puede_inactivar: boolean;
  puede_exportar: boolean;
  puede_importar: boolean;
  puede_aprobar: boolean;
  puede_asignar: boolean;
  puede_mover: boolean;
  puede_cerrar: boolean;
  puede_reabrir: boolean;
  puede_eliminar: boolean;
}

export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para acceder a la Matriz de Roles." }, { status: 403 });
    }


    // 1. Catálogo de roles funcionales
    const rolesRes = (await query(
      `SELECT rol_funcional_id as "numericId", rol_funcional_id as id, nombre, descripcion, estado
       FROM admin.rol_funcional
       WHERE estado = 'ACTIVO' OR estado IS NULL
       ORDER BY rol_funcional_id ASC`
    )) as unknown as DbRoleRow[];

    // 2. Catálogo de módulos activos oficiales
    const modulosDb = (await query(
      `SELECT modulo_sistema_id as id, nombre as label, orden, estado
       FROM admin.modulo_sistema
       WHERE estado = 'ACTIVO'
       ORDER BY orden ASC, modulo_sistema_id ASC`
    )) as unknown as DbModuloRow[];

    // 3. Catálogo de pantallas y reportes registrados
    const pantallasDb = (await query(
      `SELECT pantalla_id as id, modulo_sistema_id, codigo, nombre as label, ruta, tipo, orden, activo
       FROM admin.pantalla_sistema
       WHERE activo = true
       ORDER BY orden ASC, pantalla_id ASC`
    )) as unknown as DbPantallaRow[];

    // Catálogo de módulos activos oficiales o registrados en el sistema
    const canonicalCodes = new Set(CANONICAL_NAVIGATION.map(m => normalizeCode(m.codigo)));
    const modulesFiltered = modulosDb.filter(m => canonicalCodes.has(normalizeCode(m.label)) || m.estado === 'ACTIVO');

    // Asociar pantallas a cada módulo
    const modulesWithScreens = modulesFiltered.map(m => {
      const screens = pantallasDb.filter(p => p.modulo_sistema_id === m.id);
      return {
        ...m,
        screens
      };
    });

    // 4. Matriz de permisos a nivel de módulo
    const matrizRes = (await query("SELECT * FROM admin.matriz_acceso_rol")) as unknown as DbMatrizRow[];

    // 5. Matriz de permisos específicos a nivel de pantalla
    const pantallaMatrizRes = (await query("SELECT * FROM admin.matriz_acceso_pantalla")) as unknown as DbPantallaMatrizRow[];

    const matrixMap: Record<string, Record<number, string[]>> = {};
    const screenMatrixMap: Record<string, Record<number, { actions: string[]; isOverride: boolean }>> = {};

    rolesRes.forEach(r => {
      matrixMap[r.nombre] = {};
      screenMatrixMap[r.nombre] = {};
    });

    // Parse matriz por rol
    matrizRes.forEach(item => {
      const role = rolesRes.find(r => r.numericId === item.rol_funcional_id);
      if (role) {
        const actions: string[] = [];
        if (item.puede_ver) actions.push("ver");
        if (item.puede_crear) actions.push("crear");
        if (item.puede_editar) actions.push("editar");
        if (item.puede_inactivar) actions.push("inactivar");
        if (item.puede_exportar) actions.push("exportar");
        if (item.puede_importar) actions.push("importar");
        if (item.puede_aprobar) actions.push("aprobar");
        if (item.puede_asignar) actions.push("asignar");
        if (item.puede_mover) actions.push("mover");
        if (item.puede_cerrar) actions.push("cerrar");
        if (item.puede_reabrir) actions.push("reabrir");
        if (item.puede_eliminar) actions.push("eliminar");

        matrixMap[role.nombre][item.modulo_sistema_id] = actions;
      }
    });

    // Parse matriz por pantalla: calcular si tiene anulación específica o hereda
    rolesRes.forEach(role => {
      modulesWithScreens.forEach(mod => {
        const parentActions = matrixMap[role.nombre]?.[mod.id] || [];

        (mod.screens || []).forEach(scr => {
          const overrideRow = pantallaMatrizRes.find(
            pm => pm.rol_funcional_id === role.numericId && pm.pantalla_id === scr.id
          );

          if (overrideRow) {
            const specificActions: string[] = [];
            if (overrideRow.puede_ver) specificActions.push("ver");
            if (overrideRow.puede_crear) specificActions.push("crear");
            if (overrideRow.puede_editar) specificActions.push("editar");
            if (overrideRow.puede_inactivar) specificActions.push("inactivar");
            if (overrideRow.puede_exportar) specificActions.push("exportar");
            if (overrideRow.puede_importar) specificActions.push("importar");
            if (overrideRow.puede_aprobar) specificActions.push("aprobar");
            if (overrideRow.puede_asignar) specificActions.push("asignar");
            if (overrideRow.puede_mover) specificActions.push("mover");
            if (overrideRow.puede_cerrar) specificActions.push("cerrar");
            if (overrideRow.puede_reabrir) specificActions.push("reabrir");
            if (overrideRow.puede_eliminar) specificActions.push("eliminar");

            screenMatrixMap[role.nombre][scr.id] = {
              actions: specificActions,
              isOverride: true
            };
          } else {
            // Hereda los permisos del menú padre
            screenMatrixMap[role.nombre][scr.id] = {
              actions: [...parentActions],
              isOverride: false
            };
          }
        });
      });
    });

    return NextResponse.json({
      success: true,
      modules: modulesWithScreens,
      roles: rolesRes,
      matrix: matrixMap,
      screenMatrix: screenMatrixMap,
      rawMatrix: matrizRes,
      userPermissions: {
        puede_crear: perms.puede_crear,
        puede_editar: perms.puede_editar,
        puede_eliminar: perms.puede_eliminar
      }
    });
  } catch (error: unknown) {
    console.error("Error in GET /api/matriz-acceso-rol:", error);
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al obtener la matriz de roles y pantallas." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos de edición en la Matriz de Roles." }, { status: 403 });
    }

    const body = await req.json();
    const rolesRes = await client.query("SELECT rol_funcional_id, nombre FROM admin.rol_funcional");
    const rolesList = rolesRes.rows;

    await client.query("BEGIN");

    // Detectar si el payload viene como { matrix, screenMatrix } o por roleName directo
    const targetRolesData: Array<{
      roleName: string;
      roleId: number;
      modules: Record<string, string[]>;
      screens?: Record<string, { actions: string[]; isOverride?: boolean } | string[]>;
    }> = [];

    if (body.roleName || body.roleId) {
      const roleId = Number(body.roleId);
      const role = rolesList.find(r => r.rol_funcional_id === roleId || r.nombre === body.roleName);
      if (role) {
        targetRolesData.push({
          roleName: role.nombre,
          roleId: role.rol_funcional_id,
          modules: body.modules || {},
          screens: body.screens || {}
        });
      }
    } else if (body.matrix) {
      for (const rName of Object.keys(body.matrix)) {
        const role = rolesList.find(r => r.nombre === rName);
        if (role) {
          targetRolesData.push({
            roleName: role.nombre,
            roleId: role.rol_funcional_id,
            modules: body.matrix[rName] || {},
            screens: body.screenMatrix?.[rName] || {}
          });
        }
      }
    } else {
      // Formato directo { [roleName]: modules }
      for (const rName of Object.keys(body)) {
        const role = rolesList.find(r => r.nombre === rName);
        if (role) {
          targetRolesData.push({
            roleName: role.nombre,
            roleId: role.rol_funcional_id,
            modules: body[rName] || {},
            screens: {}
          });
        }
      }
    }

    // Procesar cada rol
    for (const item of targetRolesData) {
      const { roleId, modules, screens } = item;

      // 1. Eliminar permisos de menú anteriores para este rol
      await client.query("DELETE FROM admin.matriz_acceso_rol WHERE rol_funcional_id = $1", [roleId]);

      // 2. Insertar permisos de módulo
      const maxMatrizRes = await client.query("SELECT COALESCE(MAX(matriz_acceso_rol_id), 0) AS max_id FROM admin.matriz_acceso_rol");
      let currentMatrizId = Number(maxMatrizRes.rows[0].max_id);

      for (const modIdStr of Object.keys(modules)) {
        const modId = parseInt(modIdStr, 10);
        if (isNaN(modId)) continue;

        const actions = Array.isArray(modules[modIdStr]) ? modules[modIdStr] : [];
        const ver = actions.includes("ver");
        const crear = actions.includes("crear");
        const editar = actions.includes("editar");
        const inactivar = actions.includes("inactivar");
        const exportar = actions.includes("exportar");
        const importar = actions.includes("importar");
        const aprobar = actions.includes("aprobar");
        const asignar = actions.includes("asignar");
        const mover = actions.includes("mover");
        const cerrar = actions.includes("cerrar");
        const reabrir = actions.includes("reabrir");
        const eliminar = actions.includes("eliminar");

        currentMatrizId++;

        await client.query(
          `INSERT INTO admin.matriz_acceso_rol
           (matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id,
            puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar,
            puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
            estado, fecha_creacion, fecha_actualizacion)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'ACTIVO', now(), now())`,
          [
            currentMatrizId, roleId, modId,
            ver, crear, editar, inactivar, exportar, importar, aprobar, asignar, mover, cerrar, reabrir, eliminar
          ]
        );
      }

      // 3. Permisos específicos de pantalla (si se suministraron)
      if (screens !== undefined) {
        await client.query("DELETE FROM admin.matriz_acceso_pantalla WHERE rol_funcional_id = $1", [roleId]);

        for (const scrIdStr of Object.keys(screens)) {
          const scrId = parseInt(scrIdStr, 10);
          if (isNaN(scrId)) continue;

          const screenVal = screens[scrIdStr];
          const isOverride = typeof screenVal === "object" && screenVal !== null && "isOverride" in screenVal
            ? Boolean(screenVal.isOverride)
            : true;

          // Si no está sobrescrito (es decir, hereda del menú), no guardamos fila explícita
          if (!isOverride) continue;

          const actions: string[] = Array.isArray(screenVal)
            ? screenVal
            : (screenVal && Array.isArray(screenVal.actions) ? screenVal.actions : []);

          const ver = actions.includes("ver");
          const crear = actions.includes("crear");
          const editar = actions.includes("editar");
          const inactivar = actions.includes("inactivar");
          const exportar = actions.includes("exportar");
          const importar = actions.includes("importar");
          const aprobar = actions.includes("aprobar");
          const asignar = actions.includes("asignar");
          const mover = actions.includes("mover");
          const cerrar = actions.includes("cerrar");
          const reabrir = actions.includes("reabrir");
          const eliminar = actions.includes("eliminar");

          await client.query(
            `INSERT INTO admin.matriz_acceso_pantalla
             (rol_funcional_id, pantalla_id,
              puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar,
              puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
              estado, fecha_creacion, fecha_actualizacion)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'ACTIVO', now(), now())
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
               fecha_actualizacion = now()`,
            [
              roleId, scrId,
              ver, crear, editar, inactivar, exportar, importar, aprobar, asignar, mover, cerrar, reabrir, eliminar
            ]
          );
        }
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ success: true, message: "Matriz de roles y pantallas actualizada correctamente." });
  } catch (error: unknown) {
    await client.query("ROLLBACK");
    console.error("Error in PUT /api/matriz-acceso-rol:", error);
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al actualizar la matriz de acceso." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!perms.puede_crear) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para crear módulos en el sistema." }, { status: 403 });
    }

    const body = await req.json();
    const nombre = body.nombre;
    const rawCodigo = body.codigo;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El nombre del módulo es requerido." }, { status: 400 });
    }

    const codigo = rawCodigo && String(rawCodigo).trim()
      ? normalizeModuleCode(String(rawCodigo))
      : normalizeModuleCode(nombre);

    if (!isValidModuleCode(codigo)) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "No se pudo generar un código alfanumérico válido para el módulo." }, { status: 400 });
    }

    interface MaxIdResult {
      next_id: number;
      next_orden: number;
    }
    const maxRes = (await query(
      "SELECT COALESCE(MAX(modulo_sistema_id), 0) + 1 AS next_id, COALESCE(MAX(orden), 0) + 1 AS next_orden FROM admin.modulo_sistema"
    )) as unknown as MaxIdResult[];
    const nextId = maxRes[0]?.next_id || 1;
    const nextOrden = maxRes[0]?.next_orden || 1;

    await query(
      "INSERT INTO admin.modulo_sistema (modulo_sistema_id, codigo, nombre, orden, estado, fecha_creacion, fecha_actualizacion) VALUES ($1, $2, $3, $4, 'ACTIVO', now(), now())",
      [nextId, codigo, nombre.trim().toUpperCase(), nextOrden]
    );

    // Fail-Closed: Inicializar las 12 acciones RBAC en false para todos los roles existentes
    const activeRoles = (await query(
      "SELECT rol_funcional_id FROM admin.rol_funcional WHERE estado = 'ACTIVO' OR estado IS NULL"
    )) as unknown as Array<{ rol_funcional_id: number }>;

    const maxMatrizRes = (await query(
      "SELECT COALESCE(MAX(matriz_acceso_rol_id), 0) AS max_id FROM admin.matriz_acceso_rol"
    )) as unknown as Array<{ max_id: number }>;
    let currentMatrizId = Number(maxMatrizRes[0]?.max_id || 0);

    for (const role of activeRoles) {
      currentMatrizId++;
      await query(
        `INSERT INTO admin.matriz_acceso_rol (
           matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id,
           puede_ver, puede_crear, puede_editar, puede_inactivar,
           puede_exportar, puede_importar, puede_aprobar, puede_asignar,
           puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
           estado, fecha_creacion, fecha_actualizacion
         )
         VALUES ($1, $2, $3, false, false, false, false, false, false, false, false, false, false, false, false, 'ACTIVO', now(), now())
         ON CONFLICT (rol_funcional_id, modulo_sistema_id) DO NOTHING`,
        [currentMatrizId, role.rol_funcional_id, nextId]
      );
    }

    return NextResponse.json({ success: true, message: "Módulo creado exitosamente con permisos inicializados en modo seguro (Fail-Closed)." });
  } catch (error: unknown) {
    console.error("Error in POST /api/matriz-acceso-rol:", error);
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al crear el módulo del sistema." }, { status: 500 });
  }
}
