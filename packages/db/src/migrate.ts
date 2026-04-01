import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// manggil database url dari env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

migrate(db, { migrationsFolder: path.join(__dirname, "../drizzle") })
  .then(() => {
    console.log("Migration complete!");
    pool.end();
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    pool.end();
    process.exit(1);
  });
