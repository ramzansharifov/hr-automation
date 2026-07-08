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
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-950">{config.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{config.description}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <form onSubmit={handleSearchSubmit} className="relative">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.target.value)}
                placeholder="Поиск..."
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white sm:w-72"
              />
            </form>

            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <FiRefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Обновить
            </button>

            <button
              type="button"
              onClick={() => toast.info('Форма добавления будет в следующем патче')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <FiPlus className="h-4 w-4" />
              {config.createLabel}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              {config.columns.map((column) => (
                <th key={column.key} className="border-b border-slate-200 px-5 py-4 font-bold">
                  <button
                    type="button"
                    onClick={() => handleSort(column.key)}
                    className="flex items-center gap-2 text-left transition hover:text-blue-600"
                  >
                    {column.label}
                    {orderBy === column.key && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">
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
              <tr key={String(record.id ?? index)} className="transition hover:bg-slate-50">
                {config.columns.map((column) => (
                  <td
                    key={column.key}
                    className={[
                      'max-w-[280px] border-b border-slate-100 px-5 py-4 align-top text-slate-700',
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
                <td colSpan={config.columns.length} className="px-5 py-14 text-center">
                  <div className="mx-auto max-w-sm">
                    <p className="text-base font-semibold text-slate-900">Записей пока нет</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Попробуй изменить поиск или добавить первую запись.
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {isLoading && (
              <tr>
                <td colSpan={config.columns.length} className="px-5 py-14 text-center">
                  <p className="text-sm font-medium text-slate-500">Загрузка данных...</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Всего записей: <span className="font-semibold text-slate-900">{result.total}</span>
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FiChevronLeft className="h-4 w-4" />
            Назад
          </button>

          <span className="text-sm text-slate-500">
            {result.page} / {Math.max(result.totalPages, 1)}
          </span>

          <button
            type="button"
            disabled={!canGoForward}
            onClick={() => setPage((current) => current + 1)}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Далее
            <FiChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  )
}