import dotenv from "dotenv";
import path from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

const connectionString = process.env.DB_URL!;

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

// Export schema for use elsewhere
export * from "./schema";
