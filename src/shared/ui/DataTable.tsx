import {
  Children,
  isValidElement,
  useEffect,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { motion } from 'framer-motion'
import { FiChevronLeft, FiChevronRight, FiFileText } from 'react-icons/fi'

import { Button } from './Button'
import { EmptyState } from './EmptyState'
import { LoadingState } from './LoadingState'
import { Select } from './Select'
import { ViewModeToggle } from './ViewModeToggle'
import { useStoredViewMode, type CollectionViewMode } from './useStoredViewMode'

export interface DataTableColumn<T> {
  key: string
  header: ReactNode
  render: (row: T, index: number) => ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
  headerClassName?: string
}

export interface DataTableCardConfig<T> {
  title: (row: T, index: number) => ReactNode
  leading?: (row: T, index: number) => ReactNode
  meta?: (row: T, index: number) => ReactNode
  actions?: (row: T, index: number) => ReactNode
}

interface DataTableProps<T> {
  ariaLabel?: string
  card?: DataTableCardConfig<T>
  className?: string
  clientPagination?: boolean
  columns: DataTableColumn<T>[]
  emptyDescription?: string
  emptyTitle?: string
  footer?: ReactNode
  frame?: boolean
  getRowKey: (row: T, index: number) => string | number
  initialPageSize?: number
  isLoading?: boolean
  loadingLabel?: string
  notice?: ReactNode
  onRowClick?: (row: T) => void
  onViewModeChange?: (mode: CollectionViewMode) => void
  rows: T[]
  showViewModeToggle?: boolean
  toolbar?: ReactNode
  viewMode?: CollectionViewMode
}

const pageSizeOptions = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
]

const maxVisiblePageButtons = 5

function alignmentClass(align: DataTableColumn<unknown>['align']): string {
  if (align === 'center') return 'text-center'
  if (align === 'right') return 'text-right'
  return 'text-left'
}

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

function containsSelectControl(node: ReactNode): boolean {
  return Children.toArray(node).some((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return false
    if (child.type === Select) return true
    return containsSelectControl(
      (child as ReactElement<{ children?: ReactNode }>).props.children,
    )
  })
}

export function DataTable<T>({
  ariaLabel,
  card,
  className = '',
  clientPagination,
  columns,
  emptyDescription = 'В доступной области пока нет данных.',
  emptyTitle = 'Данных пока нет',
  footer,
  frame = true,
  getRowKey,
  initialPageSize = 10,
  isLoading = false,
  loadingLabel = 'Загрузка данных...',
  notice,
  onRowClick,
  onViewModeChange,
  rows,
  showViewModeToggle,
  toolbar,
  viewMode,
}: DataTableProps<T>): JSX.Element {
  const [storedViewMode, setStoredViewMode] = useStoredViewMode('shared-data-table')
  const resolvedViewMode = viewMode ?? storedViewMode
  const shouldShowViewModeToggle = showViewModeToggle ?? frame
  const hasExternalPagination = containsSelectControl(footer)
  const shouldUseClientPagination = clientPagination ?? !hasExternalPagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const totalPages = shouldUseClientPagination
    ? Math.max(1, Math.ceil(rows.length / pageSize))
    : 1
  const safePage = Math.min(page, totalPages)
  const pageOffset = (safePage - 1) * pageSize
  const visibleRows = shouldUseClientPagination
    ? rows.slice(pageOffset, pageOffset + pageSize)
    : rows
  const pageNumbers = getPageNumbers(safePage, totalPages)

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  function handleViewModeChange(mode: CollectionViewMode): void {
    if (onViewModeChange) {
      onViewModeChange(mode)
      return
    }
    setStoredViewMode(mode)
  }

  function handleActivate(
    event: KeyboardEvent<HTMLElement>,
    row: T,
  ): void {
    if (!onRowClick || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onRowClick(row)
  }

  function handlePageSizeChange(value: string): void {
    const nextPageSize = Number(value)
    if (!Number.isFinite(nextPageSize) || nextPageSize <= 0) return
    setPageSize(nextPageSize)
    setPage(1)
  }

  const actionColumn = columns.find((column) => column.key === 'actions')
  const contentColumns = columns.filter((column) => column.key !== 'actions')
  const titleColumn = contentColumns[0]
  const metaColumns = contentColumns.slice(1, 4)
  const hasToolbar = Boolean(toolbar || shouldShowViewModeToggle)

  function renderCardTitle(row: T, index: number): ReactNode {
    if (card) return card.title(row, index)
    return titleColumn ? titleColumn.render(row, index) : 'Запись'
  }

  function renderCardLeading(row: T, index: number): ReactNode {
    if (card?.leading) return card.leading(row, index)
    return <FiFileText className="h-5 w-5" />
  }

  function renderCardMeta(row: T, index: number): ReactNode {
    if (card?.meta) return card.meta(row, index)
    return metaColumns.map((column) => (
      <span className="app-text-soft min-w-0" key={column.key}>
        <span className="app-muted">{column.header}: </span>
        {column.render(row, index)}
      </span>
    ))
  }

  function renderCardActions(row: T, index: number): ReactNode {
    if (card?.actions) return card.actions(row, index)
    return actionColumn?.render(row, index)
  }

  const collectionContent = isLoading ? (
    <div className="px-5 py-16">
      <LoadingState label={loadingLabel} />
    </div>
  ) : rows.length === 0 ? (
    <div className="py-16">
      <EmptyState title={emptyTitle} description={emptyDescription} />
    </div>
  ) : resolvedViewMode === 'cards' ? (
    <div className="min-h-0 flex-1 overflow-auto p-5" aria-label={ariaLabel}>
      <div className="grid gap-3">
        {visibleRows.map((row, index) => {
          const globalIndex = pageOffset + index
          const actions = renderCardActions(row, globalIndex)
          return (
            <motion.article
              animate={{ opacity: 1, y: 0 }}
              className={[
                'app-surface-muted app-border flex items-center justify-between gap-4 rounded-2xl border p-4 transition',
                onRowClick
                  ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]'
                  : '',
              ].join(' ')}
              initial={{ opacity: 0, y: 8 }}
              key={getRowKey(row, globalIndex)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={(event) => handleActivate(event, row)}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              transition={{
                duration: 0.22,
                delay: Math.min(index * 0.035, 0.18),
                ease: 'easeOut',
              }}
              whileHover={{ y: onRowClick ? -2 : 0 }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <span className="app-accent-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black">
                  {renderCardLeading(row, globalIndex)}
                </span>

                <div className="min-w-0 flex-1">
                  <h4 className="app-text truncate text-sm font-black">
                    {renderCardTitle(row, globalIndex)}
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
                    {renderCardMeta(row, globalIndex)}
                  </div>
                </div>
              </div>

              {actions && (
                <div
                  className="flex shrink-0 items-center justify-center gap-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  {actions}
                </div>
              )}
            </motion.article>
          )
        })}
      </div>
    </div>
  ) : (
    <div className="min-h-0 flex-1 overflow-auto">
      <table
        aria-label={ariaLabel}
        className="min-w-full border-separate border-spacing-0 text-left text-sm"
      >
        <thead>
          <tr className="app-surface-muted app-muted text-xs uppercase tracking-wide">
            {columns.map((column) => (
              <th
                className={[
                  'app-border-soft border-b px-5 py-4 font-black',
                  alignmentClass(column.align),
                  column.headerClassName ?? '',
                ].join(' ')}
                key={column.key}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => {
            const globalIndex = pageOffset + index
            return (
              <tr
                className={[
                  'app-hover-muted transition-colors',
                  onRowClick
                    ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent-border)]'
                    : '',
                ].join(' ')}
                key={getRowKey(row, globalIndex)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={(event) => handleActivate(event, row)}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {columns.map((column) => (
                  <td
                    className={[
                      'app-border-soft border-b px-5 py-4 align-middle',
                      alignmentClass(column.align),
                      column.className ?? '',
                    ].join(' ')}
                    key={column.key}
                  >
                    {column.render(row, globalIndex)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  const clientPaginationFooter = shouldUseClientPagination ? (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        {footer && <div>{footer}</div>}
        <div className="flex items-center gap-2">
          <span className="app-muted text-sm font-medium">Записей на странице</span>
          <Select
            ariaLabel="Записей на странице"
            className="h-10 w-24 rounded-xl"
            onValueChange={handlePageSizeChange}
            options={pageSizeOptions}
            value={String(pageSize)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          disabled={safePage <= 1}
          leftIcon={<FiChevronLeft className="h-4 w-4" />}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          size="sm"
          type="button"
          variant="secondary"
        >
          Назад
        </Button>

        <div className="flex items-center gap-1">
          {pageNumbers[0] > 1 && (
            <>
              <Button
                className="min-w-10 px-3"
                onClick={() => setPage(1)}
                size="sm"
                type="button"
                variant={safePage === 1 ? 'primary' : 'secondary'}
              >
                1
              </Button>
              <span className="app-muted px-1 text-sm">...</span>
            </>
          )}

          {pageNumbers.map((pageNumber) => (
            <Button
              aria-current={pageNumber === safePage ? 'page' : undefined}
              className="min-w-10 px-3"
              key={pageNumber}
              onClick={() => setPage(pageNumber)}
              size="sm"
              type="button"
              variant={pageNumber === safePage ? 'primary' : 'secondary'}
            >
              {pageNumber}
            </Button>
          ))}

          {pageNumbers[pageNumbers.length - 1] < totalPages && (
            <>
              <span className="app-muted px-1 text-sm">...</span>
              <Button
                className="min-w-10 px-3"
                onClick={() => setPage(totalPages)}
                size="sm"
                type="button"
                variant={safePage === totalPages ? 'primary' : 'secondary'}
              >
                {totalPages}
              </Button>
            </>
          )}
        </div>

        <Button
          disabled={safePage >= totalPages}
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          rightIcon={<FiChevronRight className="h-4 w-4" />}
          size="sm"
          type="button"
          variant="secondary"
        >
          Далее
        </Button>
      </div>
    </div>
  ) : null

  const content = (
    <>
      {hasToolbar && (
        <div className="app-border-soft flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          {shouldShowViewModeToggle && (
            <ViewModeToggle onChange={handleViewModeChange} value={resolvedViewMode} />
          )}
          {toolbar && <div className={shouldShowViewModeToggle ? 'sm:ml-auto' : 'w-full'}>{toolbar}</div>}
        </div>
      )}

      {notice && (
        <div className="app-border-soft app-surface-muted border-b px-5 py-3 text-sm font-bold">
          {notice}
        </div>
      )}

      {collectionContent}

      {(footer || clientPaginationFooter) && (
        <div className="app-border-soft app-muted border-t px-5 py-4 text-sm">
          {clientPaginationFooter ?? footer}
        </div>
      )}
    </>
  )

  if (!frame) return <div className={className}>{content}</div>

  return (
    <section
      className={[
        'app-surface app-border flex flex-col overflow-hidden rounded-[28px] border',
        className,
      ].join(' ')}
    >
      {content}
    </section>
  )
}
