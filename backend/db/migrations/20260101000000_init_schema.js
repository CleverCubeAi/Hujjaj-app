const fs = require('fs');
const path = require('path');

/**
 * Applies the consolidated self-host schema (replaces supabase/migrations).
 */
exports.up = async function up(knex) {
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await knex.raw(sql);

  const appMgmtPath = path.join(__dirname, '..', 'app_management.sql');
  if (fs.existsSync(appMgmtPath)) {
    await knex.raw(fs.readFileSync(appMgmtPath, 'utf8'));
  }
};

exports.down = async function down(knex) {
  // Destructive reset — drop public schema objects created by app
  await knex.raw('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
};
