/**
 * Script ini langsung mengeksekusi SQL dari 0001_add_customers.sql
 * tanpa melalui drizzle migrate() — untuk menghindari konflik dengan
 * tabel yang sudah ada dari migration sebelumnya.
 */
import { Pool } from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, "../packages/db/drizzle/0001_add_customers.sql");
    const rawSql = readFileSync(sqlPath, "utf-8");

    // Split per statement (Drizzle pakai --> statement-breakpoint sebagai separator)
    const statements = rawSql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`Menjalankan ${statements.length} SQL statements...`);

    for (const stmt of statements) {
      try {
        await client.query(stmt);
        console.log("✓", stmt.slice(0, 60).replace(/\n/g, " ").trim() + "...");
      } catch (err: unknown) {
        const pgErr = err as { code?: string; message?: string };
        if (pgErr.code === "42P07" || pgErr.code === "42710") {
          // 42P07 = relation already exists, 42710 = type already exists — skip
          console.log("⚠ Skip (sudah ada):", stmt.slice(0, 60).replace(/\n/g, " ").trim());
        } else {
          throw err;
        }
      }
    }

    console.log("\n✓ Selesai! Tabel customers dan customer_invoices siap.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Error:", err.message ?? err);
  pool.end();
  process.exit(1);
});
