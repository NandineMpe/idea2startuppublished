import {
  createAdapterFactory,
  type CleanedWhere,
  type CustomAdapter,
  type JoinConfig,
} from "better-auth/adapters"
import { supabaseAdmin } from "@/lib/supabase"

type RowRecord = Record<string, any>
type SortBy = { field: string; direction: "asc" | "desc" }

function selectClause(select?: string[], join?: JoinConfig) {
  if (!select?.length && !join) return "*"

  const columns = new Set(select ?? [])
  if (join) {
    for (const config of Object.values(join)) {
      columns.add(config.on.from)
    }
  }

  return columns.size > 0 ? Array.from(columns).join(",") : "*"
}

function normalizeScalar(value: unknown) {
  if (value instanceof Date) return value.toISOString()
  return value
}

function applyWhereFilters(query: any, where?: CleanedWhere[]) {
  if (!where?.length) return query

  for (const condition of where) {
    const field = condition.field
    const value = condition.value

    switch (condition.operator) {
      case "eq":
        query = value === null ? query.is(field, null) : query.eq(field, normalizeScalar(value))
        break
      case "ne":
        query = value === null ? query.not(field, "is", null) : query.neq(field, normalizeScalar(value))
        break
      case "lt":
        query = query.lt(field, normalizeScalar(value))
        break
      case "lte":
        query = query.lte(field, normalizeScalar(value))
        break
      case "gt":
        query = query.gt(field, normalizeScalar(value))
        break
      case "gte":
        query = query.gte(field, normalizeScalar(value))
        break
      case "in":
        query = query.in(field, Array.isArray(value) ? value.map(normalizeScalar) : [normalizeScalar(value)])
        break
      case "not_in": {
        const values = Array.isArray(value) ? value.map((entry) => JSON.stringify(normalizeScalar(entry))).join(",") : JSON.stringify(normalizeScalar(value))
        query = query.not(field, "in", `(${values})`)
        break
      }
      case "contains":
        query = query.like(field, `%${String(value)}%`)
        break
      case "starts_with":
        query = query.like(field, `${String(value)}%`)
        break
      case "ends_with":
        query = query.like(field, `%${String(value)}`)
        break
      default:
        throw new Error(`Unsupported Better Auth where operator: ${condition.operator}`)
    }
  }

  return query
}

async function runListQuery({
  model,
  where,
  select,
  limit,
  offset,
  sortBy,
}: {
  model: string
  where?: CleanedWhere[]
  select?: string[]
  limit?: number
  offset?: number
  sortBy?: SortBy
}) {
  let query = supabaseAdmin.from(model).select(selectClause(select))
  query = applyWhereFilters(query, where)

  if (sortBy) {
    query = query.order(sortBy.field, { ascending: sortBy.direction !== "desc" })
  }

  if (limit !== undefined) {
    const start = offset ?? 0
    const end = start + Math.max(limit, 1) - 1
    query = query.range(start, end)
  } else if (offset) {
    query = query.range(offset, offset + 999)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []) as unknown as RowRecord[]
}

export const supabaseBetterAuthAdapter = createAdapterFactory({
  config: {
    adapterId: "supabase-rest",
    adapterName: "Supabase REST",
    supportsArrays: true,
    supportsBooleans: true,
    supportsDates: true,
    supportsJSON: true,
    supportsNumericIds: false,
    supportsUUIDs: true,
    transaction: false,
  },
  adapter: ({ getModelName }) => {
    async function attachJoins(rows: RowRecord[], join?: JoinConfig): Promise<RowRecord[]> {
      if (!join || rows.length === 0) return rows

      const joinedRows: RowRecord[] = rows.map((row) => ({ ...row }))

      for (const [joinModel, joinOptions] of Object.entries(join)) {
        const relatedModel = getModelName(joinModel)
        const fromField = joinOptions.on.from
        const toField = joinOptions.on.to
        const relation = joinOptions.relation ?? "one-to-many"
        const perParentLimit = relation === "one-to-one" ? 1 : Math.max(joinOptions.limit ?? 100, 1)

        const sourceValues = Array.from(
          new Set(
            joinedRows
              .map((row) => row[fromField])
              .filter((value) => value !== null && value !== undefined),
          ),
        )

        if (sourceValues.length === 0) {
          for (const row of joinedRows) {
            row[joinModel] = relation === "one-to-one" ? null : []
          }
          continue
        }

        const relatedRows = await runListQuery({
          model: relatedModel,
          where: [
            {
              connector: "AND",
              field: toField,
              operator: "in",
              value: sourceValues as string[],
            },
          ],
          limit: Math.max(sourceValues.length * perParentLimit, sourceValues.length),
        })

        const grouped = new Map<unknown, RowRecord[]>()
        for (const row of relatedRows) {
          const key = row[toField]
          const bucket = grouped.get(key) ?? []
          bucket.push(row)
          grouped.set(key, bucket)
        }

        for (const row of joinedRows) {
          const related = grouped.get(row[fromField]) ?? []
          row[joinModel] = relation === "one-to-one" ? related[0] ?? null : related.slice(0, perParentLimit)
        }
      }

      return joinedRows
    }

    const adapter: CustomAdapter = {
      create: async <T extends Record<string, any>>({
        model,
        data,
        select,
      }: {
        model: string
        data: T
        select?: string[]
      }): Promise<T> => {
        const { data: inserted, error } = await supabaseAdmin
          .from(model)
          .insert(data)
          .select(selectClause(select))
          .single()

        if (error) throw error
        if (!inserted) {
          throw new Error(`Supabase insert for ${model} returned no row.`)
        }

        return inserted as unknown as T
      },
      update: async <T>({
        model,
        where,
        update,
      }: {
        model: string
        where: CleanedWhere[]
        update: T
      }): Promise<T | null> => {
        const existing = await runListQuery({ model, where, limit: 1 })
        if (!existing[0]) return null

        let query = supabaseAdmin.from(model).update(update).select("*")
        query = applyWhereFilters(query, where)

        const { data, error } = await query.maybeSingle()
        if (error) throw error

        return (data ?? null) as unknown as T | null
      },
      async updateMany({ model, where, update }) {
        const existing = await runListQuery({ model, where, select: ["id"], limit: 1000 })
        if (existing.length === 0) return 0

        let query = supabaseAdmin.from(model).update(update).select("id")
        query = applyWhereFilters(query, where)

        const { data, error } = await query
        if (error) throw error

        const updatedRows = (data ?? []) as unknown as RowRecord[]
        return updatedRows.length || existing.length
      },
      findOne: async <T>({
        model,
        where,
        select,
        join,
      }: {
        model: string
        where: CleanedWhere[]
        select?: string[]
        join?: JoinConfig
      }): Promise<T | null> => {
        const rows = await runListQuery({ model, where, select, limit: 1 })
        if (!rows[0]) return null

        const [row] = await attachJoins(rows, join)
        return (row ?? null) as unknown as T | null
      },
      findMany: async <T>({
        model,
        where,
        limit,
        select,
        sortBy,
        offset,
        join,
      }: {
        model: string
        where?: CleanedWhere[]
        limit: number
        select?: string[]
        sortBy?: SortBy
        offset?: number
        join?: JoinConfig
      }): Promise<T[]> => {
        const rows = await runListQuery({ model, where, limit, select, sortBy, offset })
        return (await attachJoins(rows, join)) as unknown as T[]
      },
      async delete({ model, where }) {
        let query = supabaseAdmin.from(model).delete()
        query = applyWhereFilters(query, where)

        const { error } = await query
        if (error) throw error
      },
      async deleteMany({ model, where }) {
        const existing = await runListQuery({ model, where, select: ["id"], limit: 1000 })
        if (existing.length === 0) return 0

        let query = supabaseAdmin.from(model).delete().select("id")
        query = applyWhereFilters(query, where)

        const { data, error } = await query
        if (error) throw error

        const deletedRows = (data ?? []) as unknown as RowRecord[]
        return deletedRows.length || existing.length
      },
      async count({ model, where }) {
        let query = supabaseAdmin.from(model).select("*", { count: "exact", head: true })
        query = applyWhereFilters(query, where)

        const { count, error } = await query
        if (error) throw error

        return count ?? 0
      },
    }

    return adapter
  },
})
