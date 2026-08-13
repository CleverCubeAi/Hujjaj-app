import knex, { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';
import { tenantAls } from '../middleware/rlsContext';

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

const client = db.client as any;
const origAcquire = client.acquireConnection.bind(client);
client.acquireConnection = async function acquireConnection() {
  const conn = await origAcquire();
  const ctx = tenantAls.getStore();
  try {
    const isSuper = ctx ? (ctx.isSuperAdmin ? 'true' : 'false') : 'true';
    await conn.query('SELECT set_config($1, $2, false), set_config($3, $4, false)', [
      'app.agency_id',
      ctx?.agencyId || '',
      'app.is_super_admin',
      isSuper,
    ]);
  } catch {
    // GUCs / RLS role may not exist until security migrations run
  }
  return conn;
};

export default db;
export { db };
