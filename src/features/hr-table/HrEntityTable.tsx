import type { FormEvent, KeyboardEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUser,
  FiGrid,
  FiList,
} from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import type {
  HrEntityKey,
  HrFilterCondition,
  HrFilterValue,
  HrListResult,
  HrRecord,
} from '../../shared/types/hr'
import { hrApiClient } from '../../shared/lib/hrApiClient'
import { getAppLocale } from '../../shared/i18n'
import { Button, EmptyState, LoadingState, Select, type SelectOption } from '../../shared/ui'
import { HrEntityDeleteDialog } from '../hr-entities/components/HrEntityDeleteDialog'
import { HrEntityDialog } from '../hr-entities/components/HrEntityDialog'
import { getEntityConfig, renderCell } from './hrEntityConfig'

interface HrEntityTableProps {
  className?: string
  createInitialRecord?: HrRecord
  entity: HrEntityKey
  externalFilters?: Record<string, HrFilterValue | HrFilterCondition>
  hiddenColumnKeys?: string[]
  hideCreateButton?: boolean
  hideToolbar?: boolean
  hideToolbarSearch?: boolean
  onCreateClick?: () => void
  viewMode?: HrEntityTableViewMode
  onViewModeChange?: (viewMode: HrEntityTableViewMode) => void
  onRowClick?: (record: HrRecord) => void
}
type HrEntityTableViewMode = 'table' | 'cards'

const emptyResult: HrListResult = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 0,
}
const pageSizeOptions: SelectOption[] = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
]

const maxVisiblePageButtons = 5

function getPageNumbers(currentPage: number, totalPages: number): number[] {
  const safeTotalPages = Math.max(totalPages, 1)
  const half = Math.floor(maxVisiblePageButtons / 2)
  let start = Math.max(1, currentPage - half)
  const end = Math.min(safeTotalPages, start + maxVisiblePageButtons - 1)

  start = Math.max(1, end - maxVisiblePageButtons + 1)

  const pages: number[] = []

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    pages.push(pageNumber)
  }

  return pages
}
function getRecordTitle(record: HrRecord, entity: HrEntityKey): string {
  if (entity === 'employees') {
    const fullName = [record.last_name, record.first_name, record.middle_name]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .join(' ')

    return fullName || '—'
  }

  return String(record.name ?? record.title ?? record.id ?? '—')
}

function getRecordInitials(title: string): string {
  const initials = title
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toUpperCase()

  return initials || 'HR'
}
function getTableViewModeButtonClass(isActive: boolean): string {
  return [
    'inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]',
    isActive
      ? 'border-[var(--accent-border)] bg-[var(--accent)] text-white'
      : 'app-button-secondary',
  ].join(' ')
}

export function HrEntityTable({
  className = '',
  createInitialRecord,
  entity,
  externalFilters,
  hiddenColumnKeys = [],
  hideCreateButton = false,
  hideToolbar = false,
  hideToolbarSearch = false,
  onCreateClick,
  viewMode = 'table',
  onViewModeChange,
  onRowClick,
}: HrEntityTableProps): JSX.Element {
  const { i18n, t } = useTranslation()
  const locale = getAppLocale(i18n.language)
  const config = useMemo(() => getEntityConfig(entity, t, locale), [entity, locale, t])
  const visibleColumns = useMemo(
    () => config.columns.filter((column) => !hiddenColumnKeys.includes(column.key)),
    [config.columns, hiddenColumnKeys],
  )
  const [result, setResult] = useState<HrListResult>(emptyResult)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
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

  useEffect(() => {
    setPage(1)
  }, [externalFilters])

  const loadData = useCallback(async () => {
    setIsLoading(true)

    try {
      const data = await hrApiClient.list({
        entity,
        page,
        pageSize,
        search,
        filters: externalFilters,
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
  }, [entity, externalFilters, orderBy, orderDirection, page, pageSize, search, t])

  useEffect(() => {
    void loadData()
  }, [loadData, refreshIndex])
  useEffect(() => {
    const safeTotalPages = Math.max(result.totalPages, 1)

    if (page > safeTotalPages) {
      setPage(safeTotalPages)
    }
  }, [page, result.totalPages])

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setPage(1)
    setSearch(draftSearch.trim())
  }
  function handlePageSizeChange(value: string): void {
    const nextPageSize = Number(value)

    if (!Number.isFinite(nextPageSize)) {
      return
    }

    setPage(1)
    setPageSize(nextPageSize)
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
    if (onCreateClick) {
      onCreateClick()
      return
    }

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

  function handleRowKeyDown(event: KeyboardEvent<HTMLElement>, record: HrRecord): void {
    if (!onRowClick || (event.key !== 'Enter' && event.key !== ' ')) {
      return
    }

    event.preventDefault()
    onRowClick(record)
  }

  async function handleDeleteConfirm(): Promise<void> {
    await hrApiClient.delete({
      entity,
      id: getRecordId(deletingRecord),
    })
    handleRefresh()
  }

  const totalPages = Math.max(result.totalPages, 1)
  const pageNumbers = getPageNumbers(result.page, totalPages)
  const canGoBack = result.page > 1
  const canGoForward = result.totalPages > 0 && result.page < result.totalPages
  const hasActions = entity !== 'employees'
  const tableColumnCount = visibleColumns.length + (hasActions ? 1 : 0)
  const cardMetaColumns = visibleColumns.slice(1, 4)

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className={[
        'app-surface app-border flex flex-col overflow-hidden rounded-[28px] border',
        className,
      ].join(' ')}
    >
      {!hideToolbar && (
        <div className="app-border-soft flex flex-col gap-4 border-b p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            {entity === 'employees' && onViewModeChange ? (
              <div className="app-surface flex items-center gap-2 rounded-2xl border p-1">
                <button
                  type="button"
                  className={getTableViewModeButtonClass(viewMode === 'table')}
                  onClick={() => onViewModeChange('table')}
                >
                  <FiList className="h-4 w-4" />
                  Таблица
                </button>

                <button
                  type="button"
                  className={getTableViewModeButtonClass(viewMode === 'cards')}
                  onClick={() => onViewModeChange('cards')}
                >
                  <FiGrid className="h-4 w-4" />
                  Карточки
                </button>
              </div>
            ) : (
              <h3 className="app-text text-lg font-black">{config.title}</h3>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {!hideToolbarSearch && (
              <form onSubmit={handleSearchSubmit} className="relative">
                <FiSearch className="app-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                <input
                  value={draftSearch}
                  onChange={(event) => setDraftSearch(event.target.value)}
                  placeholder={t('common.fields.search')}
                  className="app-input app-placeholder h-11 w-full rounded-2xl border pl-11 pr-4 text-sm outline-none transition sm:w-72"
                />
              </form>
            )}

            <Button
              type="button"
              onClick={handleRefresh}
              leftIcon={<FiRefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
              variant="secondary"
            >
              {t('common.actions.refresh')}
            </Button>

            {!hideCreateButton && (
              <Button
                type="button"
                onClick={handleCreateClick}
                leftIcon={<FiPlus className="h-4 w-4" />}
                variant="primary"
              >
                {config.createLabel}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className={viewMode === 'table' ? 'min-h-0 flex-1 overflow-auto' : 'hidden'}>
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="app-surface-muted app-muted text-xs uppercase tracking-wide">
              {visibleColumns.map((column) => (
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
              {hasActions && (
                <th className="app-border-soft border-b px-5 py-4 text-center font-black">
                  {t('common.table.actions')}
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {result.items.map((record, index) => (
              <motion.tr
                key={String(record.id ?? index)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.22,
                  delay: Math.min(index * 0.035, 0.18),
                  ease: 'easeOut',
                }}
                whileHover={{ scale: onRowClick ? 1.002 : 1 }}
                className={['app-hover-muted transition', onRowClick ? 'cursor-pointer' : ''].join(' ')}
                onClick={onRowClick ? () => onRowClick(record) : undefined}
                onKeyDown={(event) => handleRowKeyDown(event, record)}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {visibleColumns.map((column) => (
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
                {hasActions && (
                  <td className="app-border-soft border-b px-5 py-4 align-top">
                    <div className="flex items-center justify-center gap-2" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        aria-label={t('common.actions.edit')}
                        title={t('common.actions.edit')}
                        onClick={() => handleEditClick(record)}
                        className="app-table-action-button app-table-action-button--edit inline-flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]"
                      >
                        <FiEdit2 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        aria-label={t('common.actions.delete')}
                        title={t('common.actions.delete')}
                        onClick={() => handleDeleteClick(record)}
                        className="app-table-action-button app-table-action-button--delete inline-flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                )}
              </motion.tr>
            ))}

            {!isLoading && result.items.length === 0 && (
              <tr>
                <td colSpan={tableColumnCount} className="px-5 py-16 text-center">
                  <EmptyState title={t('common.table.empty')} />
                </td>
              </tr>
            )}

            {isLoading && (
              <tr>
                <td colSpan={tableColumnCount} className="px-5 py-16 text-center">
                  <LoadingState label={t('common.table.loading')} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewMode === 'cards' && (
        <div className="min-h-0 flex-1 overflow-auto p-5">
          <div className="grid gap-3">
            {result.items.map((record, index) => {
              const title = getRecordTitle(record, entity)

              return (
                <motion.article
                  key={String(record.id ?? index)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.22,
                    delay: Math.min(index * 0.035, 0.18),
                    ease: 'easeOut',
                  }}
                  whileHover={{ y: onRowClick ? -2 : 0 }}
                  className={[
                    'app-surface-muted app-border flex items-center justify-between gap-4 rounded-2xl border p-4 transition',
                    onRowClick ? 'cursor-pointer' : '',
                  ].join(' ')}
                  onClick={onRowClick ? () => onRowClick(record) : undefined}
                  onKeyDown={(event) => handleRowKeyDown(event, record)}
                  role={onRowClick ? 'button' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <span className="app-accent-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black">
                      {entity === 'employees' ? (
                        <FiUser className="h-5 w-5" />
                      ) : (
                        getRecordInitials(title)
                      )}
                    </span>

                    <div className="min-w-0">
                      <h4 className="app-text truncate text-sm font-black">
                        {title}
                      </h4>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        {cardMetaColumns.map((column) => (
                          <span
                            key={column.key}
                            className="app-text-soft min-w-0 text-xs font-semibold"
                          >
                            <span className="app-muted">{column.label}: </span>
                            {renderCell(record, column, locale)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {hasActions && (
                    <div
                      className="flex shrink-0 items-center justify-center gap-2"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        aria-label={t('common.actions.edit')}
                        title={t('common.actions.edit')}
                        onClick={() => handleEditClick(record)}
                        className="app-table-action-button app-table-action-button--edit inline-flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]"
                      >
                        <FiEdit2 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        aria-label={t('common.actions.delete')}
                        title={t('common.actions.delete')}
                        onClick={() => handleDeleteClick(record)}
                        className="app-table-action-button app-table-action-button--delete inline-flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </motion.article>
              )
            })}

            {!isLoading && result.items.length === 0 && (
              <div className="px-5 py-16 text-center">
                <EmptyState title={t('common.table.empty')} />
              </div>
            )}

            {isLoading && (
              <div className="px-5 py-16 text-center">
                <LoadingState label={t('common.table.loading')} />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="app-border-soft flex flex-col gap-4 border-t px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <p className="app-muted text-sm">
            {t('common.table.total')}: <span className="app-text font-bold">{result.total}</span>
          </p>

          <div className="flex items-center gap-2">
            <span className="app-muted text-sm font-medium">{t('common.table.pageSize')}</span>
            <Select
              ariaLabel={t('common.table.pageSize')}
              className="h-10 w-24 rounded-xl"
              onValueChange={handlePageSizeChange}
              options={pageSizeOptions}
              value={String(pageSize)}
            />
            <span className="app-muted text-sm font-medium">{t('common.table.pageSizeSuffix')}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            disabled={!canGoBack}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            leftIcon={<FiChevronLeft className="h-4 w-4" />}
            size="sm"
            variant="secondary"
          >
            {t('common.actions.back')}
          </Button>

          <div className="flex items-center gap-1">
            {pageNumbers[0] > 1 && (
              <>
                <Button
                  type="button"
                  onClick={() => setPage(1)}
                  size="sm"
                  variant={result.page === 1 ? 'primary' : 'secondary'}
                  className="min-w-10 px-3"
                >
                  1
                </Button>
                <span className="app-muted px-1 text-sm">...</span>
              </>
            )}

            {pageNumbers.map((pageNumber) => (
              <Button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                size="sm"
                variant={pageNumber === result.page ? 'primary' : 'secondary'}
                className="min-w-10 px-3"
                aria-current={pageNumber === result.page ? 'page' : undefined}
              >
                {pageNumber}
              </Button>
            ))}

            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                <span className="app-muted px-1 text-sm">...</span>
                <Button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  size="sm"
                  variant={result.page === totalPages ? 'primary' : 'secondary'}
                  className="min-w-10 px-3"
                >
                  {totalPages}
                </Button>
              </>
            )}
          </div>

          <Button
            type="button"
            disabled={!canGoForward}
            onClick={() => setPage((current) => current + 1)}
            rightIcon={<FiChevronRight className="h-4 w-4" />}
            size="sm"
            variant="secondary"
          >
            {t('common.actions.next')}
          </Button>
        </div>
      </div>

      <HrEntityDialog
        entity={entity}
        initialRecord={dialogMode === 'create' ? createInitialRecord : editingRecord}
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
    </motion.section>
  )
}
