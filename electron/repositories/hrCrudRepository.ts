import type Database from 'better-sqlite3'
import type {
  HrDashboardStats,
  HrListParams,
  HrListResult,
  HrRecord,
} from '../../src/shared/types/hr'
import type { HrCrudEntityConfig } from '../admin/hrCrudEntities'

interface SqlWhereResult {
  sql: string
  params: Record<string, unknown>
}

const maxHrPageSize = 50000

export class HrCrudRepository {
  constructor(private readonly database: Database.Database) {}

  list(config: HrCrudEntityConfig, params: HrListParams): HrListResult {
    const page = normalizePage(params.page)
    const pageSize = normalizePageSize(params.pageSize)
    const offset = (page - 1) * pageSize
    const where = this.buildWhere(config, params)
    const orderBy = this.normalizeOrderBy(config, params.orderBy)
    const orderDirection = params.orderDirection === 'desc' ? 'DESC' : 'ASC'

    const items = this.database
      .prepare(
        `
        SELECT *
        FROM ${config.tableName}
        ${where.sql}
        ORDER BY ${orderBy} ${orderDirection}
        LIMIT @limit OFFSET @offset
      `,
      )
      .all({
        ...where.params,
        limit: pageSize,
        offset,
      }) as HrRecord[]

    const countResult = this.database
      .prepare(
        `
        SELECT COUNT(*) as total
        FROM ${config.tableName}
        ${where.sql}
      `,
      )
      .get(where.params) as { total: number }

    return {
      items,
      total: countResult.total,
      page,
      pageSize,
      totalPages: Math.ceil(countResult.total / pageSize),
    }
  }

  getById(config: HrCrudEntityConfig, id: number): HrRecord | null {
    const row = this.database
      .prepare(
        `
        SELECT *
        FROM ${config.tableName}
        WHERE ${config.primaryKey} = ?
        LIMIT 1
      `,
      )
      .get(id) as HrRecord | undefined

    return row ?? null
  }

  create(config: HrCrudEntityConfig, data: HrRecord): HrRecord {
    const safeData = this.pickEditableData(config, data)

    if (Object.keys(safeData).length === 0) {
      throw new Error('Нет разрешённых полей для создания записи')
    }

    const columns = Object.keys(safeData)
    const placeholders = columns.map((column) => `@${column}`)

    const result = this.database
      .prepare(
        `
        INSERT INTO ${config.tableName} (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
      `,
      )
      .run(safeData)

    const created = this.getById(config, Number(result.lastInsertRowid))

    if (!created) {
      throw new Error('Созданная запись не найдена')
    }

    return created
  }

  update(config: HrCrudEntityConfig, id: number, data: HrRecord): HrRecord {
    const safeData = this.pickEditableData(config, data)

    if (Object.keys(safeData).length === 0) {
      throw new Error('Нет разрешённых полей для обновления записи')
    }

    const setParts = Object.keys(safeData).map((column) => `${column} = @${column}`)

    if (config.hasUpdatedAt) {
      setParts.push('updated_at = CURRENT_TIMESTAMP')
    }

    this.database
      .prepare(
        `
        UPDATE ${config.tableName}
        SET ${setParts.join(', ')}
        WHERE ${config.primaryKey} = @id
      `,
      )
      .run({
        ...safeData,
        id,
      })

    const updated = this.getById(config, id)

    if (!updated) {
      throw new Error('Обновлённая запись не найдена')
    }

    return updated
  }

  delete(config: HrCrudEntityConfig, id: number): void {
    this.database
      .prepare(
        `
        DELETE FROM ${config.tableName}
        WHERE ${config.primaryKey} = ?
      `,
      )
      .run(id)
  }

  dashboard(): HrDashboardStats {
    const currentMonth = new Date().toISOString().slice(0, 7)

    const employeesTotal = this.getNumber('SELECT COUNT(*) FROM employees')
    const departmentsTotal = this.getNumber('SELECT COUNT(*) FROM departments')
    const positionsTotal = this.getNumber('SELECT COUNT(*) FROM positions')
    const activeVacations = this.getNumber(`
      SELECT COUNT(*)
      FROM vacations
      WHERE status IN ('planned', 'approved')
    `)

    const payrollMonthTotal = this.getNumber(
      `
      SELECT COALESCE(SUM(net_amount), 0)
      FROM payroll
      WHERE accrual_month = ?
    `,
      [currentMonth],
    )

    return {
      employeesTotal,
      departmentsTotal,
      positionsTotal,
      activeVacations,
      payrollMonthTotal,
    }
  }

  private buildWhere(config: HrCrudEntityConfig, params: HrListParams): SqlWhereResult {
    const conditions: string[] = []
    const values: Record<string, unknown> = {}

    if (params.search && config.searchableColumns.length > 0) {
      const searchConditions = config.searchableColumns.map((column, index) => {
        const key = `search_${index}`
        values[key] = `%${params.search}%`

        return `${column} LIKE @${key}`
      })

      conditions.push(`(${searchConditions.join(' OR ')})`)
    }

    if (params.filters) {
      Object.entries(params.filters).forEach(([column, value], index) => {
        if (!config.allowedColumns.includes(column) || value === undefined || value === null) {
          return
        }

        if (Array.isArray(value)) {
          const safeValues = value.filter((item) => item !== null && item !== undefined && item !== '')

          if (safeValues.length === 0) {
            conditions.push('1 = 0')
            return
          }

          const keys = safeValues.map((_item, itemIndex) => `filter_${index}_${itemIndex}`)

          keys.forEach((key, itemIndex) => {
            values[key] = safeValues[itemIndex]
          })

          conditions.push(`${column} IN (${keys.map((key) => `@${key}`).join(', ')})`)
          return
        }

        if (value === '') {
          return
        }

        const key = `filter_${index}`
        conditions.push(`${column} = @${key}`)
        values[key] = value
      })
    }

    return {
      sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params: values,
    }
  }

  private normalizeOrderBy(config: HrCrudEntityConfig, orderBy?: string): string {
    if (orderBy && config.allowedColumns.includes(orderBy)) {
      return orderBy
    }

    return config.defaultOrderBy
  }

  private pickEditableData(config: HrCrudEntityConfig, data: HrRecord): HrRecord {
    const ignoredColumns = new Set(['id', 'created_at', 'updated_at'])
    const result: HrRecord = {}

    Object.entries(data).forEach(([key, value]) => {
      if (ignoredColumns.has(key)) {
        return
      }

      if (!config.allowedColumns.includes(key)) {
        return
      }

      result[key] = value
    })

    return result
  }

  private getNumber(sql: string, params: unknown[] = []): number {
    const result = this.database.prepare(sql).pluck().get(...params) as number | null | undefined

    return Number(result ?? 0)
  }
}

function normalizePage(page?: number): number {
  if (!page || page < 1) {
    return 1
  }

  return Math.floor(page)
}

function normalizePageSize(pageSize?: number): number {
  if (!pageSize || pageSize < 1) {
    return 20
  }

  return Math.min(Math.floor(pageSize), maxHrPageSize)
}