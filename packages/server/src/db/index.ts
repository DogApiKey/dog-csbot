import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(url: string) {
  const client = postgres(url, { max: 10 });
  return drizzle(client, { schema });
}

export { schema };
