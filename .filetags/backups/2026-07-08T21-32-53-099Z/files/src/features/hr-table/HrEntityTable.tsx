import type { FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiChevronLeft, FiChevronRight, FiPlus, FiRefreshCw, FiSearch } from 'react-icons/fi'
import { toast } from 'react-toastify'
import type { HrEntityKey, HrListResult } from '../../shared/types/hr'
import { hrApiClient } from '../../shared/lib/hrApiClient'
import { getEntityConfig, renderCell } from './hrEntityConfig'

interface HrEntityTableProps {
  entity: HrEntityKey
}

const emptyResult: HrListResult = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 0,
}

export function HrEntityTable({ entity }: HrEntityTableProps): JSX.Element {
  const config = useMemo(() => getEntityConfig(entity), [entity])
  const [result, setResult] = useState<HrListResult>(emptyResult)
  const [page, setPage] = useState(1)
  const [draftSearch, setDraftSearch] = useState('')
  const [search, setSearch] = useState('')
  const [orderBy, setOrderBy] = useState(config.defaultOrderBy)
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('asc')
  const [isLoading, setIsLoading] = useState(false)
  const [refreshIndex, setRefreshIndex] = useState(0)

  useEffect(() => {
    setPage(1)
    setDraftSearch('')
    setSearch('')
    setOrderBy(config.defaultOrderBy)
    setOrderDirection('asc')
  }, [config.defaultOrderBy, entity])

  const loadData = useCallback(async () => {
    setIsLoading(true)

    try {
      const data = await hrApiClient.list({
        entity,
        page,
        pageSize: 10,
        search,
        orderBy,
        orderDirection,
      })

      setResult(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить данные'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [entity, orderBy, orderDirection, page, refreshIndex, search])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setPage(1)
    setSearch(draftSearch.trim())
  }

  function handleSort(columnKey: string): void {
    setPage(1)

    if (orderBy === columnKey) {
      setOrderDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setOrderBy(columnKey)
    setOrderDirection('asc')
  }

  function handleRefresh(): void {
    setRefreshIndex((current) => current + 1)
  }

  const canGoBack = result.page > 1
  const canGoForward = result.totalPages > 0 && result.page < result.totalPages

  return (
    <section className="app-surface app-shadow overflow-hidden rounded-[28px] border">
      <div className="app-border-soft flex flex-col gap-4 border-b p-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h3 className="app-text text-lg font-black">{config.title}</h3>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <form onSubmit={handleSearchSubmit} className="relative">
            <FiSearch className="app-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Поиск"
              className="app-input app-placeholder h-11 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none transition sm:w-72"
            />
          </form>

          <button
            type="button"
            onClick={handleRefresh}
            className="app-button-secondary inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition"
          >
            <FiRefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Обновить
          </button>

          <button
            type="button"
            onClick={() => toast.info('Форма добавления будет в следующем патче')}
            className="app-button-primary inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold shadow-sm transition"
          >
            <FiPlus className="h-4 w-4" />
            {config.createLabel}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="app-surface-muted app-muted text-xs uppercase tracking-wide">
              {config.columns.map((column) => (
                <th key={column.key} className="app-border-soft border-b px-5 py-4 font-black">
                  <button
                    type="button"
                    onClick={() => handleSort(column.key)}
                    className="flex items-center gap-2 text-left transition hover:text-[var(--accent)]"
                  >
                    {column.label}
                    {orderBy === column.key && (
                      <span className="app-accent-soft rounded-full px-2 py-0.5 text-[10px]">
                        {orderDirection === 'asc' ? 'ASC' : 'DESC'}
                      </span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {result.items.map((record, index) => (
              <tr key={String(record.id ?? index)} className="app-hover-muted transition">
                {config.columns.map((column) => (
                  <td
                    key={column.key}
                    className={[
                      'app-border-soft app-text-soft max-w-[280px] border-b px-5 py-4 align-top',
                      column.className ?? '',
                    ].join(' ')}
                  >
                    <span className="line-clamp-2">{renderCell(record, column)}</span>
                  </td>
                ))}
              </tr>
            ))}

            {!isLoading && result.items.length === 0 && (
              <tr>
                <td colSpan={config.columns.length} className="px-5 py-16 text-center">
                  <p className="app-text text-base font-black">Записей пока нет</p>
                </td>
              </tr>
            )}

            {isLoading && (
              <tr>
                <td colSpan={config.columns.length} className="px-5 py-16 text-center">
                  <p className="app-muted text-sm font-medium">Загрузка...</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="app-border-soft flex flex-col gap-4 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="app-muted text-sm">
          Всего: <span className="app-text font-bold">{result.total}</span>
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="app-button-secondary inline-flex h-10 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FiChevronLeft className="h-4 w-4" />
            Назад
          </button>

          <span className="app-muted text-sm">
            {result.page} / {Math.max(result.totalPages, 1)}
          </span>

          <button
            type="button"
            disabled={!canGoForward}
            onClick={() => setPage((current) => current + 1)}
            className="app-button-secondary inline-flex h-10 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Далее
            <FiChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  )
}
