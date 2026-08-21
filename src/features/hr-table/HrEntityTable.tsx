import type { FormEvent } from 'react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
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
} from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { useAuth } from '../auth/AuthContext'
import type {
  HrEntityKey,
  HrFilterCondition,
  HrFilterValue,
  HrListResult,
  HrRecord,
} from '../../shared/types/hr'
import { hrApiClient } from '../../shared/lib/hrApiClient'
import { getAppLocale } from '../../shared/i18n'
import {
  Button,
  DataTable,
  IconButton,
  Select,
  type DataTableColumn,
  type SelectOption,
} from '../../shared/ui'
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

export interface HrEntityTableHandle {
  openCreate: () => void
  refresh: () => void
}

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

const managePermissionByEntity: Record<HrEntityKey, string> = {
  enterprises: 'organization.manage',
  departments: 'organization.manage',
  positions: 'organization.manage',
  employees: 'employees.manage',
  employee_education: 'employees.manage',
  employee_experience: 'employees.manage',
  employment_history: 'employees.manage',
  vacation_types: 'vacations.manage',
  vacations: 'vacations.manage',
}

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

export const HrEntityTable = forwardRef<HrEntityTableHandle, HrEntityTableProps>(
  function HrEntityTable(
    {
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
    },
    ref,
  ): JSX.Element {
    const { i18n, t } = useTranslation()
    const { hasPermission, session } = useAuth()
    const locale = getAppLocale(i18n.language)
    const config = useMemo(() => getEntityConfig(entity, t, locale), [entity, locale, t])
    const visibleColumns = useMemo(
      () => config.columns.filter((column) => !hiddenColumnKeys.includes(column.key)),
      [config.columns, hiddenColumnKeys],
    )
    const permissionCode = managePermissionByEntity[entity]
    const canManageEntity =
      entity !== 'employment_history' &&
      hasPermission(permissionCode) &&
      (entity !== 'vacation_types' || session.permissionScopes[permissionCode] === 'global')
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
      if (page > safeTotalPages) setPage(safeTotalPages)
    }, [page, result.totalPages])

    function handleSearchSubmit(event: FormEvent<HTMLFormElement>): void {
      event.preventDefault()
      setPage(1)
      setSearch(draftSearch.trim())
    }

    function handlePageSizeChange(value: string): void {
      const nextPageSize = Number(value)
      if (!Number.isFinite(nextPageSize)) return
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

    const handleRefresh = useCallback((): void => {
      setRefreshIndex((current) => current + 1)
    }, [])

    const handleCreateClick = useCallback((): void => {
      if (!canManageEntity) return
      if (onCreateClick) {
        onCreateClick()
        return
      }

      setDialogMode('create')
      setEditingRecord(null)
      setIsFormOpen(true)
    }, [canManageEntity, onCreateClick])

    useImperativeHandle(
      ref,
      () => ({
        openCreate: handleCreateClick,
        refresh: handleRefresh,
      }),
      [handleCreateClick, handleRefresh],
    )

    function handleEditClick(record: HrRecord): void {
      if (!canManageEntity) return
      setDialogMode('edit')
      setEditingRecord(record)
      setIsFormOpen(true)
    }

    function handleDeleteClick(record: HrRecord): void {
      if (!canManageEntity) return
      setDeletingRecord(record)
      setIsDeleteOpen(true)
    }

    function getRecordId(record: HrRecord | null): number {
      const rawId = record?.id
      const id = typeof rawId === 'number' ? rawId : Number(rawId)
      if (!Number.isFinite(id)) throw new Error(t('forms.errors.missingId'))
      return id
    }

    async function handleFormSubmit(data: HrRecord): Promise<void> {
      if (!canManageEntity) throw new Error('Недостаточно прав для изменения записи')
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
      if (!canManageEntity) throw new Error('Недостаточно прав для удаления записи')
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
    const hasActions = canManageEntity && entity !== 'employees'
    const cardMetaColumns = visibleColumns.slice(1, 4)

    const columns: DataTableColumn<HrRecord>[] = [
      ...visibleColumns.map((column): DataTableColumn<HrRecord> => ({
        key: column.key,
        header: (
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
        ),
        className: [
          'app-text-soft max-w-[280px] align-top',
          column.className ?? '',
        ].join(' '),
        render: (record) => (
          <span className="line-clamp-2">{renderCell(record, column, locale)}</span>
        ),
      })),
      ...(hasActions
        ? [
            {
              key: 'actions',
              header: t('common.table.actions'),
              align: 'center' as const,
              className: 'align-top',
              render: (record: HrRecord) => (
                <div
                  className="flex items-center justify-center gap-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <IconButton
                    className="app-table-action-button app-table-action-button--edit"
                    icon={<FiEdit2 />}
                    label={t('common.actions.edit')}
                    onClick={() => handleEditClick(record)}
                    size="sm"
                  />
                  <IconButton
                    className="app-table-action-button app-table-action-button--delete"
                    icon={<FiTrash2 />}
                    label={t('common.actions.delete')}
                    onClick={() => handleDeleteClick(record)}
                    size="sm"
                    tone="danger"
                  />
                </div>
              ),
            },
          ]
        : []),
    ]

    const toolbar = hideToolbar ? undefined : (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
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
          leftIcon={
            <FiRefreshCw
              className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
            />
          }
          variant="secondary"
        >
          {t('common.actions.refresh')}
        </Button>

        {!hideCreateButton && canManageEntity && (
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
    )

    const footer = (
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
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
    )

    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <DataTable
            ariaLabel={config.title}
            card={{
              leading: (record) => {
                const title = getRecordTitle(record, entity)
                return entity === 'employees' ? (
                  <FiUser className="h-5 w-5" />
                ) : (
                  getRecordInitials(title)
                )
              },
              title: (record) => getRecordTitle(record, entity),
              meta: (record) => (
                <>
                  {cardMetaColumns.map((column) => (
                    <span
                      key={column.key}
                      className="app-text-soft min-w-0 text-xs font-semibold"
                    >
                      <span className="app-muted">{column.label}: </span>
                      {renderCell(record, column, locale)}
                    </span>
                  ))}
                </>
              ),
              actions: hasActions
                ? (record) => (
                    <>
                      <IconButton
                        className="app-table-action-button app-table-action-button--edit"
                        icon={<FiEdit2 />}
                        label={t('common.actions.edit')}
                        onClick={() => handleEditClick(record)}
                        size="sm"
                      />
                      <IconButton
                        className="app-table-action-button app-table-action-button--delete"
                        icon={<FiTrash2 />}
                        label={t('common.actions.delete')}
                        onClick={() => handleDeleteClick(record)}
                        size="sm"
                        tone="danger"
                      />
                    </>
                  )
                : undefined,
            }}
            className={className}
            columns={columns}
            emptyTitle={t('common.table.empty')}
            footer={footer}
            frame
            getRowKey={(record, index) => String(record.id ?? index)}
            isLoading={isLoading}
            loadingLabel={t('common.table.loading')}
            onRowClick={onRowClick}
            onViewModeChange={hideToolbar ? undefined : onViewModeChange}
            rows={result.items}
            toolbar={toolbar}
            viewMode={viewMode}
          />
        </motion.div>

        {canManageEntity && (
          <>
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
          </>
        )}
      </>
    )
  },
)
