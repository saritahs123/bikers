import { Pool, PoolConfig, PoolClient, QueryResultRow } from "pg";

const globalForPg = globalThis as typeof globalThis & {
  __bikersPgPool?: Pool;
};

const normalizePem = (value?: string) =>
  value?.replace(/\\n/g, "\n").trim();

const createPool = (): Pool => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("La variable DATABASE_URL no está configurada.");
  }

  // PROTECCIÓN DE SEGURIDAD ESTRICTA: MODO PRUEBAS (POSTGRESQL 18 LOCAL)
  const isTestEnv = process.env.APP_ENV === "test";
  if (isTestEnv) {
    try {
      const url = new URL(connectionString);
      const host = (url.hostname || "").toLowerCase();
      const port = parseInt(url.port || "5432", 10);
      const db = (url.pathname || "").replace(/^\//, "");
      const allowedHosts = ["127.0.0.1", "localhost", "::1"];

      if (
        !allowedHosts.includes(host) ||
        port !== 5432 ||
        db !== "bikers_dbtest" ||
        host.includes("amazonaws.com") ||
        host.includes("bikerrd.com")
      ) {
        throw new Error(
          `[BLOQUEO CRÍTICO DE SEGURIDAD] Intento de conexión a destino no autorizado (${host}:${port}/${db}) en APP_ENV=test. Solo se permite 127.0.0.1:5432/bikers_dbtest. Destinos externos, túneles (59083) y pools (6432) están terminantemente bloqueados.`
        );
      }
    } catch (parseErr: any) {
      if (parseErr.message && parseErr.message.includes("[BLOQUEO CRÍTICO")) {
        throw parseErr;
      }
      throw new Error("[BLOQUEO CRÍTICO DE SEGURIDAD] Formato de DATABASE_URL inválido en modo test.");
    }
  }

  const configuredMax = Number.parseInt(
    process.env.DB_POOL_MAX || "2",
    10
  );

  const poolConfig: PoolConfig = {
    connectionString,
    max:
      Number.isInteger(configuredMax) && configuredMax > 0
        ? configuredMax
        : (isTestEnv ? 5 : 2),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
    application_name: isTestEnv ? "bikers-test-local-pg18" : "bikers-vercel",
  };

  const ca = normalizePem(process.env.DATABASE_SSL_CA);
  const certificate = normalizePem(process.env.DATABASE_SSL_CERT);
  const privateKey = normalizePem(process.env.DATABASE_SSL_KEY);

  // En modo test local, la conexión se realiza sin SSL a 127.0.0.1
  if (!isTestEnv) {
    if (
      process.env.NODE_ENV === "production" ||
      ca ||
      certificate ||
      privateKey
    ) {
      poolConfig.ssl = {
        rejectUnauthorized: true,
        ...(ca ? { ca } : {}),
        ...(certificate ? { cert: certificate } : {}),
        ...(privateKey ? { key: privateKey } : {}),
      };
    }
  }

  const pool = new Pool(poolConfig);

  pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", {
      code: (error as { code?: string }).code,
      message: error.message,
    });
  });

  return pool;
};

export const getPool = (): Pool => {
  if (!globalForPg.__bikersPgPool) {
    globalForPg.__bikersPgPool = createPool();
  }

  return globalForPg.__bikersPgPool;
};

export const query = async <T = QueryResultRow>(
  sql: string,
  parameters: unknown[] = []
): Promise<T[]> => {
  try {
    const result = await getPool().query(sql, parameters);
    return result.rows as unknown as T[];
  } catch (error: unknown) {
    const databaseError = error as {
      code?: string;
      message?: string;
    };

    console.error("Database Query Error:", {
      code: databaseError.code,
      message: databaseError.message,
    });

    throw error;
  }
};

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}