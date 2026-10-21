#!/usr/bin/env python3
"""Generate src/lib/database.types.ts by introspecting the database.

Exists because the Supabase CLI needs Docker, which this machine does not
have. Output is shape-compatible with `supabase gen types typescript`, so
swapping back later is a drop-in change.
"""
import json, subprocess, sys, os

DB = os.environ["DATABASE_URL"]
OUT = sys.argv[1]

QUERY = r"""
select json_build_object(
  'enums', coalesce((
    select json_agg(json_build_object('name', t.typname, 'values', v.vals) order by t.typname)
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace and n.nspname = 'public'
    join lateral (select array_agg(e.enumlabel order by e.enumsortorder) as vals
                  from pg_enum e where e.enumtypid = t.oid) v on true
    where t.typtype = 'e'), '[]'::json),
  'relations', coalesce((
    select json_agg(json_build_object(
      'name', c.relname,
      'kind', c.relkind,
      'columns', (
        select json_agg(json_build_object(
          'name', a.attname,
          'type', case when bt.typname is not null then bt.typname else t.typname end,
          'enum', case when (case when bt.typtype is not null then bt.typtype else t.typtype end) = 'e'
                       then (case when bt.typname is not null then bt.typname else t.typname end) end,
          'nullable', not a.attnotnull,
          'hasdefault', (ad.adbin is not null or a.attidentity <> '' or a.attgenerated <> ''),
          'generated', a.attgenerated <> ''
        ) order by a.attnum)
        from pg_attribute a
        join pg_type t on t.oid = a.atttypid
        left join pg_type bt on bt.oid = nullif(t.typbasetype, 0)
        left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      )) order by c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where c.relkind in ('r','v') and c.relname <> 'schema_migrations'), '[]'::json),
  'fks', coalesce((
    select json_agg(json_build_object(
      'name', con.conname,
      'table', cl.relname,
      'columns', (select array_agg(att.attname order by k.ord)
                  from unnest(con.conkey) with ordinality k(attnum, ord)
                  join pg_attribute att on att.attrelid = cl.oid and att.attnum = k.attnum),
      'reftable', rcl.relname,
      'refcolumns', (select array_agg(att.attname order by k.ord)
                     from unnest(con.confkey) with ordinality k(attnum, ord)
                     join pg_attribute att on att.attrelid = rcl.oid and att.attnum = k.attnum),
      'unique', exists (
        select 1 from pg_constraint u
        where u.conrelid = con.conrelid and u.contype in ('p','u')
          and u.conkey @> con.conkey and con.conkey @> u.conkey)
    ))
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_class rcl on rcl.oid = con.confrelid
    join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
    where con.contype = 'f'), '[]'::json),
  'functions', coalesce((
    select json_agg(json_build_object('name', p.proname,
                                      'args', pg_get_function_arguments(p.oid),
                                      'returns', pg_get_function_result(p.oid)) order by p.proname)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
    where p.prokind = 'f'
      -- Exclude functions installed by an extension (pgcrypto, btree_gist).
      -- They are not app API, and their overloads collide as object keys.
      and not exists (select 1 from pg_depend d
                      where d.objid = p.oid and d.deptype = 'e')), '[]'::json)
);
"""

raw = subprocess.run(["psql", DB, "-tAc", QUERY], capture_output=True, text=True, check=True).stdout
meta = json.loads(raw)

SCALARS = {
    "uuid": "string", "text": "string", "varchar": "string", "bpchar": "string", "name": "string",
    "citext": "string", "int2": "number", "int4": "number", "int8": "number",
    "numeric": "number", "float4": "number", "float8": "number", "bool": "boolean",
    "timestamptz": "string", "timestamp": "string", "date": "string", "time": "string",
    "timetz": "string", "interval": "string", "json": "Json", "jsonb": "Json",
    "daterange": "string", "int4range": "string", "bytea": "string",
}

def ts(col):
    base = f'Database["public"]["Enums"]["{col["enum"]}"]' if col["enum"] else SCALARS.get(col["type"], "unknown")
    return base + (" | null" if col["nullable"] else "")

def camel(name):
    return "".join(p.capitalize() for p in name.split("_"))

L = []
L.append("// GENERATED FILE - do not edit by hand.")
L.append("// Regenerate with:  cd skolopals-db && make types")
L.append("//")
L.append("// Produced by scripts/gen-types.py, which introspects the database directly.")
L.append("// The Supabase CLI needs Docker; this does not. Output is shape-compatible")
L.append("// with `supabase gen types typescript`, so switching back is a drop-in change.")
L.append("")
L.append("export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];")
L.append("")

tables = [r for r in meta["relations"] if r["kind"] == "r"]
views  = [r for r in meta["relations"] if r["kind"] == "v"]
fks_by_table = {}
for fk in meta["fks"]:
    fks_by_table.setdefault(fk["table"], []).append(fk)

L.append("export type Database = {")
L.append("  public: {")
L.append("    Tables: {")
for t in tables:
    L.append(f'      {t["name"]}: {{')
    L.append("        Row: {")
    for c in t["columns"]:
        L.append(f'          {c["name"]}: {ts(c)};')
    L.append("        };")
    L.append("        Insert: {")
    for c in t["columns"]:
        if c["generated"]:
            continue
        opt = "?" if (c["hasdefault"] or c["nullable"]) else ""
        L.append(f'          {c["name"]}{opt}: {ts(c)};')
    L.append("        };")
    L.append("        Update: {")
    for c in t["columns"]:
        if c["generated"]:
            continue
        L.append(f'          {c["name"]}?: {ts(c)};')
    L.append("        };")
    rels = fks_by_table.get(t["name"], [])
    if not rels:
        L.append("        Relationships: [];")
    else:
        L.append("        Relationships: [")
        for fk in rels:
            cols = ", ".join(f'"{c}"' for c in fk["columns"])
            refs = ", ".join(f'"{c}"' for c in fk["refcolumns"])
            L.append("          {")
            L.append(f'            foreignKeyName: "{fk["name"]}";')
            L.append(f"            columns: [{cols}];")
            L.append(f'            isOneToOne: {"true" if fk["unique"] else "false"};')
            L.append(f'            referencedRelation: "{fk["reftable"]}";')
            L.append(f"            referencedColumns: [{refs}];")
            L.append("          },")
        L.append("        ];")
    L.append("      };")
L.append("    };")

L.append("    Views: {")
for v in views:
    L.append(f'      {v["name"]}: {{')
    L.append("        Row: {")
    for c in v["columns"]:
        L.append(f'          {c["name"]}: {ts(c)};')
    L.append("        };")
    L.append("        Relationships: [];")
    L.append("      };")
L.append("    };")

L.append("    Functions: {")
# Overloaded SQL functions share a name; as object keys they would collide.
for name in sorted({f["name"] for f in meta["functions"]}):
    L.append(f'      {name}: {{ Args: Record<string, unknown>; Returns: unknown }};')
L.append("    };")

L.append("    Enums: {")
for e in meta["enums"]:
    vals = " | ".join(f'"{v}"' for v in e["values"])
    L.append(f'      {e["name"]}: {vals};')
L.append("    };")
L.append("    CompositeTypes: Record<string, never>;")
L.append("  };")
L.append("};")
L.append("")

L.append("/* Helpers. Prefer these over the aliases below - they can never be wrong")
L.append("   about pluralisation, and they fail to compile on a renamed table. */")
L.append('export type Row<T extends keyof Database["public"]["Tables"]> =')
L.append('  Database["public"]["Tables"][T]["Row"];')
L.append('export type Insert<T extends keyof Database["public"]["Tables"]> =')
L.append('  Database["public"]["Tables"][T]["Insert"];')
L.append('export type Update<T extends keyof Database["public"]["Tables"]> =')
L.append('  Database["public"]["Tables"][T]["Update"];')
L.append('export type ViewRow<T extends keyof Database["public"]["Views"]> =')
L.append('  Database["public"]["Views"][T]["Row"];')
L.append("")
L.append("/* Row aliases, named after the table. Plural, deliberately: guessing a")
L.append("   singular form breaks on words like \"expenses\" and \"addresses\". */")
for e in meta["enums"]:
    vals = " | ".join(f'"{v}"' for v in e["values"])
    L.append(f'export type {camel(e["name"])} = {vals};')
L.append("")
for t in tables:
    L.append(f'export type {camel(t["name"])} = Database["public"]["Tables"]["{t["name"]}"]["Row"];')
for v in views:
    L.append(f'export type {camel(v["name"])} = Database["public"]["Views"]["{v["name"]}"]["Row"];')
L.append("")

open(OUT, "w").write("\n".join(L))
print(f"wrote {OUT}: {len(tables)} tables, {len(views)} views, {len(meta['enums'])} enums")
