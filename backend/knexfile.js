require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dotenv').config();

module.exports = {
  client: 'pg',
  connection: process.env.DATABASE_URL || 'postgres://hujjaj:hujjaj@localhost:5432/hujjaj',
  migrations: {
    directory: './db/migrations',
    tableName: 'knex_migrations',
  },
};
