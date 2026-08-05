import knex, { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'Missing DATABASE_URL. Set it in the project root .env (see env.example).'
  );
}

const db: Knex = knex({
  client: 'pg',
  connection: databaseUrl,
  pool: { min: 0, max: 10 },
});

export default db;
export { db };
