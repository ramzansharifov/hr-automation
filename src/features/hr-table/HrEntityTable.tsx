import type { FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import type { HrEntityKey, HrListResult, HrRecord } from '../../shared/types/hr'
import { hrApiClient } from '../../shared/lib/hrApiClient'
import { getAppLocale } from '../../shared/i18n'
import { Button } from '../../shared/ui'
import { HrEntityDeleteDialog } from '../hr-entities/components/HrEntityDeleteDialog'
import { HrEntityDialog } from '../hr-entities/components/HrEntityDialog'
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
  const { i18n, t } = useTranslation()
  const locale = getAppLocale(i18n.language)
  const config = useMemo(() => getEntityConfig(entity, t, locale), [entity, locale, t])
  const [result, setResult] = useState<HrListResult>(emptyResult)
  const [page, setPage] = useState(1)
  const [draftSearch, setDraftSearch] = useState('')
  const [search, setSearch] = useState('')
  const [orderBy, setOrderBy] = useState(config.defaultOrderBy)
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('asc')
  const [isLoading, setIsLoading] = useState(false)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editingRecord, setEditingRecord] = useState<HrRecord | null>(null)
  const [deletingRecord, setDeletingRecord] = useState<HrRecord | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

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
      const message = error instanceof Error ? error.message : t('common.errors.dataLoad')
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [entity, orderBy, orderDirection, page, refreshIndex, search, t])

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

  function handleCreateClick(): void {
    setDialogMode('create')
    setEditingRecord(null)
    setIsFormOpen(true)
  }

  function handleEditClick(record: HrRecord): void {
    setDialogMode('edit')
    setEditingRecord(record)
    setIsFormOpen(true)
  }

  function handleDeleteClick(record: HrRecord): void {
    setDeletingRecord(record)
    setIsDeleteOpen(true)
  }

  function getRecordId(record: HrRecord | null): number {
    const rawId = record?.id
    const id = typeof rawId === 'number' ? rawId : Number(rawId)

    if (!Number.isFinite(id)) {
      throw new Error(t('forms.errors.missingId'))
    }

    return id
  }

  async function handleFormSubmit(data: HrRecord): Promise<void> {
    if (dialogMode === 'create') {
      await hrApiClient.create({ entity, data })
      handleRefresh()
      return
    }

    await hrApiClient.update({
      entity,
      id: getRecordId(editingRecord),
      data,
    })
    handleRefresh()
  }

  async function handleDeleteConfirm(): Promise<void> {
    await hrApiClient.delete({
      entity,
      id: getRecordId(deletingRecord),
    })
    handleRefresh()
  }

  const canGoBack = result.page > 1
  const canGoForward = result.totalPages > 0 && result.page < result.totalPages
  const tableColumnCount = config.columns.length + 1

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
              placeholder={t('common.fields.search')}
              className="app-input app-placeholder h-11 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none transition sm:w-72"
            />
          </form>

          <button
            type="button"
            onClick={handleRefresh}
            className="app-button-secondary inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition"
          >
            <FiRefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {t('common.actions.refresh')}
          </button>

          <button
            type="button"
            onClick={handleCreateClick}
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
                        {orderDirection === 'asc'
                          ? t('common.table.sort.asc')
                          : t('common.table.sort.desc')}
                      </span>
                    )}
                  </button>
                </th>
              ))}
              <th className="app-border-soft border-b px-5 py-4 text-right font-black">
                {t('common.table.actions')}
              </th>
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
                    <span className="line-clamp-2">{renderCell(record, column, locale)}</span>
                  </td>
                ))}
                <td className="app-border-soft border-b px-5 py-4 align-top">
                  <div className="flex justify-end gap-2">
                    <Button
                      aria-label={t('common.actions.edit')}
                      onClick={() => handleEditClick(record)}
                      size="sm"
                      variant="ghost"
                    >
                      <FiEdit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label={t('common.actions.delete')}
                      onClick={() => handleDeleteClick(record)}
                      size="sm"
                      variant="ghost"
                    >
                      <FiTrash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}

            {!isLoading && result.items.length === 0 && (
              <tr>
                <td colSpan={tableColumnCount} className="px-5 py-16 text-center">
                  <p className="app-text text-base font-black">{t('common.table.empty')}</p>
                </td>
              </tr>
            )}

            {isLoading && (
              <tr>
                <td colSpan={tableColumnCount} className="px-5 py-16 text-center">
                  <p className="app-muted text-sm font-medium">{t('common.table.loading')}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="app-border-soft flex flex-col gap-4 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="app-muted text-sm">
          {t('common.table.total')}: <span className="app-text font-bold">{result.total}</span>
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="app-button-secondary inline-flex h-10 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FiChevronLeft className="h-4 w-4" />
            {t('common.actions.back')}
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
            {t('common.actions.next')}
            <FiChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <HrEntityDialog
        entity={entity}
        initialRecord={editingRecord}
        mode={dialogMode}
        onOpenChange={setIsFormOpen}
        onSubmit={handleFormSubmit}
        open={isFormOpen}
      />

      <HrEntityDeleteDialog
        onConfirm={handleDeleteConfirm}
        onOpenChange={setIsDeleteOpen}
        open={isDeleteOpen}
      />
    </section>
  )
}
