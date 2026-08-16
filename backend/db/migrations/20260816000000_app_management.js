const fs = require('fs');
const path = require('path');

exports.up = async function up(knex) {
  const sqlPath = path.join(__dirname, '..', 'app_management.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await knex.raw(sql);
};

exports.down = async function down(knex) {
  await knex.raw(`
    ALTER TABLE agencies DROP CONSTRAINT IF EXISTS agencies_subscription_status_check;
    ALTER TABLE agencies DROP COLUMN IF EXISTS name_ar;
    ALTER TABLE agencies DROP COLUMN IF EXISTS legal_name;
    ALTER TABLE agencies DROP COLUMN IF EXISTS phone;
    ALTER TABLE agencies DROP COLUMN IF EXISTS email;
    ALTER TABLE agencies DROP COLUMN IF EXISTS address;
    ALTER TABLE agencies DROP COLUMN IF EXISTS website;
    ALTER TABLE agencies DROP COLUMN IF EXISTS invoice_logo_url;
    ALTER TABLE agencies DROP COLUMN IF EXISTS primary_color;
    ALTER TABLE agencies DROP COLUMN IF EXISTS invoice_footer;
    ALTER TABLE agencies DROP COLUMN IF EXISTS hide_platform_mark;
    ALTER TABLE agencies DROP COLUMN IF EXISTS package_id;
    ALTER TABLE agencies DROP COLUMN IF EXISTS subscription_status;
    ALTER TABLE agencies DROP COLUMN IF EXISTS subscription_starts_at;
    ALTER TABLE agencies DROP COLUMN IF EXISTS subscription_renews_at;
    ALTER TABLE agencies DROP COLUMN IF EXISTS billing_email;
    DROP TABLE IF EXISTS subscription_events;
    DROP TABLE IF EXISTS subscription_invoices;
    DROP TABLE IF EXISTS platform_counters;
    DROP TABLE IF EXISTS platform_payment_gateways;
    DROP TABLE IF EXISTS platform_llm_usage;
    DROP TABLE IF EXISTS platform_llm_settings;
    DROP TABLE IF EXISTS platform_email_settings;
    DROP TABLE IF EXISTS platform_branding;
    DROP TABLE IF EXISTS subscription_packages;
  `);
};
