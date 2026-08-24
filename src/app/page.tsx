import CalculadoraApp from "@/components/CalculadoraApp";
import AuthGate from "@/components/AuthGate";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // O site funciona sem Postgres: a DB só é usada se DATABASE_URL existir
  // (ex.: no Vercel). Localmente, sem a variável, pula o health-check.
  if (process.env.DATABASE_URL) {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`select 1`);
  }
  return (
    <AuthGate>
      <CalculadoraApp />
    </AuthGate>
  );
}
