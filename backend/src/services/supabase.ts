/**
 * Compatibility export — query layer is Knex via query.ts.
 * Controllers import supabaseAdmin.from() / .rpc() as before.
 */
export { supabaseAdmin, default } from './query';
export { db } from './db';
