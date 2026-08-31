exports.up = async function up(knex) {
  const hasColumn = await knex.schema.hasColumn('user_preferences', 'notifications_last_seen_at');
  if (!hasColumn) {
    await knex.schema.alterTable('user_preferences', (t) => {
      t.timestamp('notifications_last_seen_at', { useTz: true });
    });
  }
};

exports.down = async function down(knex) {
  const hasColumn = await knex.schema.hasColumn('user_preferences', 'notifications_last_seen_at');
  if (hasColumn) {
    await knex.schema.alterTable('user_preferences', (t) => {
      t.dropColumn('notifications_last_seen_at');
    });
  }
};
