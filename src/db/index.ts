import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Inicialização lazy: sem DATABASE_URL configurada não partimos o build/import,
// apenas quando alguém tentar realmente usar a base de dados.
const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDrizzle?: ReturnType<typeof drizzle>;
};

function getDb(): ReturnType<typeof drizzle> {
  if (globalForDb.__arenaNextJsDrizzle) return globalForDb.__arenaNextJsDrizzle;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  let pool = globalForDb.__arenaNextJsPostgresqlPool;
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl });
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }

  const instance = drizzle(pool);
  globalForDb.__arenaNextJsDrizzle = instance;
  return instance;
}

export function getPool(): Pool | undefined {
  return globalForDb.__arenaNextJsPostgresqlPool;
}

/** Proxy que só inicializa a DB quando algo é usado de facto. */
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const instance = getDb() as unknown as Record<string | symbol, unknown>;
    const value = instance[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
