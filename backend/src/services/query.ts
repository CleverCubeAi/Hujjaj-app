/**
 * Knex-backed query client with a Supabase/PostgREST-like API.
 * Controllers keep .from().select().eq() chains; execution uses Knex.
 */
import { Knex } from 'knex';
import db from './db';

type Filter =
  | { type: 'eq'; column: string; value: unknown }
  | { type: 'neq'; column: string; value: unknown }
  | { type: 'in'; column: string; value: unknown[] }
  | { type: 'is'; column: string; value: null | boolean }
  | { type: 'gte'; column: string; value: unknown }
  | { type: 'lte'; column: string; value: unknown }
  | { type: 'gt'; column: string; value: unknown }
  | { type: 'lt'; column: string; value: unknown }
  | { type: 'like'; column: string; value: string }
  | { type: 'ilike'; column: string; value: string }
  | { type: 'not'; column: string; operator: string; value: unknown }
  | { type: 'or'; expression: string }
  | { type: 'contains'; column: string; value: unknown };

interface Embed {
  alias: string;
  table: string;
  columns: string | null;
  foreignKeyHint?: string;
  many: boolean;
  nestedEmbeds?: Embed[];
}

interface RelationDef {
  table: string;
  foreignKey: string;
  type: 'belongsTo' | 'hasMany';
  localKey?: string;
}

/** FK map for nested select hydration */
const RELATIONS: Record<string, Record<string, RelationDef>> = {
  bookings: {
    clients: { table: 'clients', foreignKey: 'client_id', type: 'belongsTo' },
    seasons: { table: 'seasons', foreignKey: 'season_id', type: 'belongsTo' },
    flights: { table: 'flights', foreignKey: 'flight_id', type: 'belongsTo' },
    accommodations: { table: 'accommodations', foreignKey: 'accommodation_id', type: 'belongsTo' },
    room_types: { table: 'room_types', foreignKey: 'room_type_id', type: 'belongsTo' },
    pilgrims: { table: 'pilgrims', foreignKey: 'booking_id', type: 'hasMany', localKey: 'id' },
    users: { table: 'users', foreignKey: 'created_by', type: 'belongsTo' },
    creator: { table: 'users', foreignKey: 'created_by', type: 'belongsTo' },
    invoice_items: { table: 'invoice_items', foreignKey: 'booking_id', type: 'hasMany', localKey: 'id' },
    payments: { table: 'payments', foreignKey: 'booking_id', type: 'hasMany', localKey: 'id' },
    room_assignments: { table: 'room_assignments', foreignKey: 'booking_id', type: 'hasMany', localKey: 'id' },
  },
  invoice_items: {
    extra_services: { table: 'extra_services', foreignKey: 'extra_service_id', type: 'belongsTo' },
    pilgrims: { table: 'pilgrims', foreignKey: 'pilgrim_id', type: 'belongsTo' },
  },
  flights: {
    seasons: { table: 'seasons', foreignKey: 'season_id', type: 'belongsTo' },
    flight_transits: { table: 'flight_transits', foreignKey: 'flight_id', type: 'hasMany', localKey: 'id' },
    transits: { table: 'flight_transits', foreignKey: 'flight_id', type: 'hasMany', localKey: 'id' },
  },
  accommodations: {
    seasons: { table: 'seasons', foreignKey: 'season_id', type: 'belongsTo' },
    room_types: { table: 'room_types', foreignKey: 'accommodation_id', type: 'hasMany', localKey: 'id' },
  },
  pilgrims: {
    seasons: { table: 'seasons', foreignKey: 'season_id', type: 'belongsTo' },
    flights: { table: 'flights', foreignKey: 'flight_id', type: 'belongsTo' },
    accommodations: { table: 'accommodations', foreignKey: 'accommodation_id', type: 'belongsTo' },
    room_types: { table: 'room_types', foreignKey: 'room_type_id', type: 'belongsTo' },
    packages: { table: 'packages', foreignKey: 'package_id', type: 'belongsTo' },
    bookings: { table: 'bookings', foreignKey: 'booking_id', type: 'belongsTo' },
  },
  users: {
    branches: { table: 'branches', foreignKey: 'branch_id', type: 'belongsTo' },
    branch: { table: 'branches', foreignKey: 'branch_id', type: 'belongsTo' },
  },
  hotel_bed_inventory: {
    accommodations: { table: 'accommodations', foreignKey: 'accommodation_id', type: 'belongsTo' },
    room_types: { table: 'room_types', foreignKey: 'room_type_id', type: 'belongsTo' },
    seasons: { table: 'seasons', foreignKey: 'season_id', type: 'belongsTo' },
  },
  flight_seat_inventory: {
    flights: { table: 'flights', foreignKey: 'flight_id', type: 'belongsTo' },
    seasons: { table: 'seasons', foreignKey: 'season_id', type: 'belongsTo' },
  },
  expenses: {
    expense_categories: { table: 'expense_categories', foreignKey: 'category_id', type: 'belongsTo' },
    seasons: { table: 'seasons', foreignKey: 'season_id', type: 'belongsTo' },
  },
  financial_handovers: {
    branches: { table: 'branches', foreignKey: 'branch_id', type: 'belongsTo' },
  },
  booking_locks: {
    users: { table: 'users', foreignKey: 'user_id', type: 'belongsTo' },
  },
  room_assignments: {
    pilgrims: { table: 'pilgrims', foreignKey: 'pilgrim_id', type: 'belongsTo' },
    accommodations: { table: 'accommodations', foreignKey: 'accommodation_id', type: 'belongsTo' },
    room_types: { table: 'room_types', foreignKey: 'room_type_id', type: 'belongsTo' },
  },
};

/** Split on commas that are not inside parentheses */
function splitTopLevel(input: string, separator = ','): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of input) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === separator && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return parts;
}

function parseSelect(selectStr: string | undefined): { columns: string[] | '*'; embeds: Embed[] } {
  if (!selectStr || selectStr.trim() === '*' || selectStr.trim() === '') {
    return { columns: '*', embeds: [] };
  }

  const working = selectStr.replace(/\n/g, ' ').trim();
  const parts = splitTopLevel(working);
  const columns: string[] = [];
  const embeds: Embed[] = [];

  for (const part of parts) {
    // alias:table!hint (cols) — e.g. creator:users!bookings_created_by_fkey (...)
    const aliasMatch = part.match(
      /^([a-zA-Z_][\w]*)\s*:\s*([a-zA-Z_][\w]*)(?:!([a-zA-Z_][\w]*))?\s*\(([\s\S]*)\)$/
    );
    // table (cols)
    const simpleMatch = part.match(/^([a-zA-Z_][\w]*)\s*\(([\s\S]*)\)$/);

    if (aliasMatch) {
      const [, alias, tableName, hint, inner] = aliasMatch;
      const nested = parseSelect(inner.trim() || '*');
      embeds.push({
        alias,
        table: tableName,
        columns: nested.columns === '*' ? '*' : (nested.columns as string[]).join(', '),
        foreignKeyHint: hint,
        many: false,
        nestedEmbeds: nested.embeds.length ? nested.embeds : undefined,
      });
    } else if (simpleMatch) {
      const [, tableName, inner] = simpleMatch;
      const nested = parseSelect(inner.trim() || '*');
      embeds.push({
        alias: tableName,
        table: tableName,
        columns: nested.columns === '*' ? '*' : (nested.columns as string[]).join(', '),
        many: false,
        nestedEmbeds: nested.embeds.length ? nested.embeds : undefined,
      });
    } else if (part === '*') {
      columns.push('*');
    } else if (part) {
      columns.push(part);
    }
  }

  const finalColumns = columns.length === 0 || columns.includes('*') ? '*' : columns;
  return { columns: finalColumns as string[] | '*', embeds };
}

function applyFilters(qb: Knex.QueryBuilder, filters: Filter[]) {
  for (const f of filters) {
    switch (f.type) {
      case 'eq':
        qb.where(f.column, f.value as any);
        break;
      case 'neq':
        qb.whereNot(f.column, f.value as any);
        break;
      case 'in':
        if (f.value.length === 0) qb.whereRaw('false');
        else qb.whereIn(f.column, f.value as any[]);
        break;
      case 'is':
        if (f.value === null) qb.whereNull(f.column);
        else qb.where(f.column, f.value);
        break;
      case 'gte':
        qb.where(f.column, '>=', f.value as any);
        break;
      case 'lte':
        qb.where(f.column, '<=', f.value as any);
        break;
      case 'gt':
        qb.where(f.column, '>', f.value as any);
        break;
      case 'lt':
        qb.where(f.column, '<', f.value as any);
        break;
      case 'like':
        qb.where(f.column, 'like', f.value);
        break;
      case 'ilike':
        qb.where(f.column, 'ilike', f.value);
        break;
      case 'not':
        if (f.operator === 'is' && f.value === null) qb.whereNotNull(f.column);
        else if (f.operator === 'eq') qb.whereNot(f.column, f.value as any);
        else if (f.operator === 'in') qb.whereNotIn(f.column, f.value as any[]);
        else qb.whereNot(f.column, f.value as any);
        break;
      case 'contains':
        qb.where(f.column, '@>', f.value as any);
        break;
      case 'or': {
        // PostgREST style: "col.eq.val,col2.ilike.%x%"
        qb.andWhere((builder) => {
          const parts = f.expression.split(',');
          for (const part of parts) {
            const m = part.trim().match(/^([a-zA-Z_][\w]*)\.(eq|neq|gt|gte|lt|lte|like|ilike|is)\.(.*)$/);
            if (!m) continue;
            const [, col, op, rawVal] = m;
            let val: unknown = rawVal;
            if (rawVal === 'null') val = null;
            else if (rawVal === 'true') val = true;
            else if (rawVal === 'false') val = false;
            builder.orWhere((b) => {
              if (op === 'eq') b.where(col, val as any);
              else if (op === 'neq') b.whereNot(col, val as any);
              else if (op === 'ilike') b.where(col, 'ilike', val as string);
              else if (op === 'like') b.where(col, 'like', val as string);
              else if (op === 'is' && val === null) b.whereNull(col);
              else if (op === 'gte') b.where(col, '>=', val as any);
              else if (op === 'lte') b.where(col, '<=', val as any);
              else if (op === 'gt') b.where(col, '>', val as any);
              else if (op === 'lt') b.where(col, '<', val as any);
            });
          }
        });
        break;
      }
    }
  }
}

async function hydrateEmbeds(
  table: string,
  rows: Record<string, any>[],
  embeds: Embed[]
): Promise<Record<string, any>[]> {
  if (!rows.length || !embeds.length) return rows;

  const tableRels = RELATIONS[table] || {};

  for (const embed of embeds) {
    const rel =
      tableRels[embed.alias] ||
      tableRels[embed.table] ||
      ({
        table: embed.table,
        foreignKey: `${embed.table.replace(/s$/, '')}_id`,
        type: 'belongsTo',
      } as RelationDef);

    const selectCols =
      !embed.columns || embed.columns === '*'
        ? '*'
        : embed.columns.split(',').map((c) => c.trim()).filter(Boolean);

    if (rel.type === 'belongsTo') {
      const ids = [...new Set(rows.map((r) => r[rel.foreignKey]).filter(Boolean))];
      let related: Record<string, any>[] = [];
      if (ids.length) {
        let q = db(rel.table).whereIn('id', ids as string[]);
        if (selectCols !== '*') {
          const cols = Array.from(new Set(['id', ...(selectCols as string[])]));
          q = q.select(...cols);
        }
        related = await q;
      }
      if (embed.nestedEmbeds?.length) {
        related = await hydrateEmbeds(rel.table, related, embed.nestedEmbeds);
      }
      const byId = new Map(related.map((r) => [r.id, r]));
      for (const row of rows) {
        row[embed.alias] = byId.get(row[rel.foreignKey]) || null;
      }
    } else {
      const localKey = rel.localKey || 'id';
      const parentIds = rows.map((r) => r[localKey]);
      let related: Record<string, any>[] = [];
      if (parentIds.length) {
        let q = db(rel.table).whereIn(rel.foreignKey, parentIds);
        if (selectCols !== '*') {
          const cols = Array.from(new Set([rel.foreignKey, ...(selectCols as string[])]));
          q = q.select(cols);
        }
        related = await q;
      }
      if (embed.nestedEmbeds?.length) {
        related = await hydrateEmbeds(rel.table, related, embed.nestedEmbeds);
      }
      const byParent = new Map<string, any[]>();
      for (const r of related) {
        const key = r[rel.foreignKey];
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key)!.push(r);
      }
      for (const row of rows) {
        row[embed.alias] = byParent.get(row[localKey]) || [];
      }
    }
  }

  return rows;
}

class QueryBuilder {
  private table: string;
  private filters: Filter[] = [];
  private selectStr?: string;
  private orderBy: { column: string; ascending: boolean }[] = [];
  private limitN?: number;
  private offsetN?: number;
  private preferCount = false;
  private headOnly = false;
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: any;
  private upsertOpts?: { onConflict?: string; ignoreDuplicates?: boolean };

  constructor(table: string) {
    this.table = table;
  }

  select(columns?: string, options?: { count?: string; head?: boolean }) {
    this.selectStr = columns;
    if (options?.count) this.preferCount = true;
    if (options?.head) this.headOnly = true;
    return this;
  }

  insert(data: any) {
    this.op = 'insert';
    this.payload = data;
    return this;
  }

  update(data: any) {
    this.op = 'update';
    this.payload = data;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  upsert(data: any, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.op = 'upsert';
    this.payload = data;
    this.upsertOpts = opts;
    return this;
  }

  eq(column: string, value: unknown) {
    // Skip null/undefined filters so platform super_admin (no agency) can list across tenants
    if (value === null || value === undefined) return this;
    this.filters.push({ type: 'eq', column, value });
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push({ type: 'neq', column, value });
    return this;
  }
  in(column: string, value: unknown[]) {
    this.filters.push({ type: 'in', column, value });
    return this;
  }
  is(column: string, value: null | boolean) {
    this.filters.push({ type: 'is', column, value });
    return this;
  }
  gte(column: string, value: unknown) {
    this.filters.push({ type: 'gte', column, value });
    return this;
  }
  lte(column: string, value: unknown) {
    this.filters.push({ type: 'lte', column, value });
    return this;
  }
  gt(column: string, value: unknown) {
    this.filters.push({ type: 'gt', column, value });
    return this;
  }
  lt(column: string, value: unknown) {
    this.filters.push({ type: 'lt', column, value });
    return this;
  }
  like(column: string, value: string) {
    this.filters.push({ type: 'like', column, value });
    return this;
  }
  ilike(column: string, value: string) {
    this.filters.push({ type: 'ilike', column, value });
    return this;
  }
  not(column: string, operator: string, value: unknown) {
    this.filters.push({ type: 'not', column, operator, value });
    return this;
  }
  or(expression: string) {
    this.filters.push({ type: 'or', expression });
    return this;
  }
  contains(column: string, value: unknown) {
    this.filters.push({ type: 'contains', column, value });
    return this;
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy.push({ column, ascending: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  range(from: number, to: number) {
    this.offsetN = from;
    this.limitN = to - from + 1;
    return this;
  }

  async single() {
    const result = await this.execute();
    if (result.error) return result;
    const rows = result.data as any[] | null;
    if (!rows || rows.length === 0) {
      return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } };
    }
    return { data: rows[0], error: null, count: result.count };
  }

  async maybeSingle() {
    const result = await this.execute();
    if (result.error) return result;
    const rows = result.data as any[] | null;
    if (!rows || rows.length === 0) return { data: null, error: null, count: result.count };
    return { data: rows[0], error: null, count: result.count };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }

  private async execute(): Promise<{ data: any; error: any; count?: number | null }> {
    try {
      if (this.op === 'insert') {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        const inserted = await db(this.table).insert(rows).returning('*');
        const { embeds } = parseSelect(this.selectStr);
        const hydrated = await hydrateEmbeds(this.table, inserted, embeds);
        return { data: hydrated, error: null };
      }

      if (this.op === 'upsert') {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        const conflict = this.upsertOpts?.onConflict || 'id';
        let q = db(this.table).insert(rows);
        if (this.upsertOpts?.ignoreDuplicates) {
          q = q.onConflict(conflict.split(',')).ignore() as any;
        } else {
          q = q.onConflict(conflict.split(',')).merge() as any;
        }
        const result = await (q as Knex.QueryBuilder).returning('*');
        return { data: Array.isArray(this.payload) ? result : result[0] ?? result, error: null };
      }

      if (this.op === 'update') {
        let q = db(this.table).update(this.payload);
        applyFilters(q, this.filters);
        const updated = await q.returning('*');
        // If chain continues with .select().single() pattern — controllers call .update().eq().select().single()
        // Our select() after update just marks prefer returning
        return { data: updated, error: null };
      }

      if (this.op === 'delete') {
        let q = db(this.table).delete();
        applyFilters(q, this.filters);
        await q;
        return { data: null, error: null };
      }

      // SELECT
      const { columns, embeds } = parseSelect(this.selectStr);

      if (this.preferCount) {
        let countQ = db(this.table).count({ count: '*' });
        applyFilters(countQ, this.filters);
        const [{ count }] = await countQ;
        if (this.headOnly) return { data: null, error: null, count: Number(count) };
      }

      let q = db(this.table);
      if (columns === '*') q = q.select('*');
      else q = q.select(columns as string[]);

      applyFilters(q, this.filters);
      for (const o of this.orderBy) {
        q = q.orderBy(o.column, o.ascending ? 'asc' : 'desc');
      }
      if (this.limitN !== undefined) q = q.limit(this.limitN);
      if (this.offsetN !== undefined) q = q.offset(this.offsetN);

      let rows = await q;
      rows = await hydrateEmbeds(this.table, rows, embeds);

      let count: number | null = null;
      if (this.preferCount) {
        let countQ = db(this.table).count({ count: '*' });
        applyFilters(countQ, this.filters);
        const [c] = await countQ;
        count = Number(c.count);
      }

      return { data: rows, error: null, count };
    } catch (err: any) {
      console.error(`[query] ${this.op} ${this.table}:`, err.message);
      return { data: null, error: { message: err.message, code: err.code } };
    }
  }
}

/** Fix update().eq().select().single() — select after update should return filtered rows */
const originalUpdate = QueryBuilder.prototype.update;
QueryBuilder.prototype.update = function (data: any) {
  originalUpdate.call(this, data);
  const builder = this;
  const origSelect = builder.select.bind(builder);
  builder.select = function (columns?: string, options?: any) {
    origSelect(columns, options);
    // After update+select, execute returns updated rows; single() takes first
    const origExecute = (builder as any).execute.bind(builder);
    (builder as any).execute = async function () {
      try {
        let q = db(builder['table']).update(builder['payload']);
        applyFilters(q, builder['filters']);
        const updated = await q.returning('*');
        const { embeds } = parseSelect(columns);
        const hydrated = await hydrateEmbeds(builder['table'], updated, embeds);
        return { data: hydrated, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message, code: err.code } };
      }
    };
    return builder;
  };
  return builder;
};

async function rpc(fnName: string, params: Record<string, unknown> = {}) {
  try {
    if (fnName === 'exec_sql') {
      // Not supported — return empty for fallback paths in discounts controller
      return { data: null, error: { message: 'exec_sql is not available on self-hosted Postgres' } };
    }

    const keys = Object.keys(params);
    const values = keys.map((k) => params[k]);
    // Prefer named args: SELECT * FROM fn(p_a := ?, p_b := ?)
    const named = keys.map((k) => `${k} := ?`).join(', ');
    const sql = keys.length
      ? `SELECT * FROM ${fnName}(${named})`
      : `SELECT * FROM ${fnName}()`;
    const result = await db.raw(sql, values as any[]);
    const rows = result.rows ?? result;
    // Scalar / setof — if single column "result" unwrap? Return rows as data
    if (Array.isArray(rows) && rows.length === 1) {
      const row = rows[0];
      const vals = Object.values(row);
      // Functions returning TABLE look like rows; functions returning scalar often one key
      if (vals.length === 1 && typeof vals[0] !== 'object') {
        return { data: vals[0], error: null };
      }
    }
    return { data: rows, error: null };
  } catch (err: any) {
    console.error(`[rpc] ${fnName}:`, err.message);
    return { data: null, error: { message: err.message, code: err.code } };
  }
}

export const supabaseAdmin = {
  from(table: string) {
    return new QueryBuilder(table);
  },
  rpc,
};

export default supabaseAdmin;
