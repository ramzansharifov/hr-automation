import type { KeyboardEvent, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { FiFileText } from 'react-icons/fi'

import { EmptyState } from './EmptyState'
import { LoadingState } from './LoadingState'
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
  columns: DataTableColumn<T>[]
  emptyDescription?: string
  emptyTitle?: string
  footer?: ReactNode
  frame?: boolean
  getRowKey: (row: T, index: number) => string | number
  isLoading?: boolean
  loadingLabel?: string
  notice?: ReactNode
  onRowClick?: (row: T) => void
  onViewModeChange?: (mode: CollectionViewMode) => void
  rows: T[]
  toolbar?: ReactNode
  viewMode?: CollectionViewMode
}

function alignmentClass(align: DataTableColumn<unknown>['align']): string {
  if (align === 'center') return 'text-center'
  if (align === 'right') return 'text-right'
  return 'text-left'
}

export function DataTable<T>({
  ariaLabel,
  card,
  className = '',
  columns,
  emptyDescription = 'В доступной области пока нет данных.',
  emptyTitle = 'Данных пока нет',
  footer,
  frame = true,
  getRowKey,
  isLoading = false,
  loadingLabel = 'Загрузка данных...',
  notice,
  onRowClick,
  onViewModeChange,
  rows,
  toolbar,
  viewMode,
}: DataTableProps<T>): JSX.Element {
  const [storedViewMode, setStoredViewMode] = useStoredViewMode('shared-data-table')
  const resolvedViewMode = viewMode ?? storedViewMode
  const resolvedViewModeChange = onViewModeChange ?? (frame ? setStoredViewMode : undefined)

  function handleActivate(
    event: KeyboardEvent<HTMLElement>,
    row: T,
  ): void {
    if (!onRowClick || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onRowClick(row)
  }

  const actionColumn = columns.find((column) => column.key === 'actions')
  const contentColumns = columns.filter((column) => column.key !== 'actions')
  const titleColumn = contentColumns[0]
  const metaColumns = contentColumns.slice(1, 4)
  const hasToolbar = Boolean(toolbar || resolvedViewModeChange)

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
        {rows.map((row, index) => {
          const actions = renderCardActions(row, index)
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
              key={getRowKey(row, index)}
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
                  {renderCardLeading(row, index)}
                </span>

                <div className="min-w-0 flex-1">
                  <h4 className="app-text truncate text-sm font-black">
                    {renderCardTitle(row, index)}
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
                    {renderCardMeta(row, index)}
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
          {rows.map((row, index) => (
            <tr
              className={[
                'app-hover-muted transition-colors',
                onRowClick
                  ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent-border)]'
                  : '',
              ].join(' ')}
              key={getRowKey(row, index)}
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
                  {column.render(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const content = (
    <>
      {hasToolbar && (
        <div className="app-border-soft flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          {resolvedViewModeChange && (
            <ViewModeToggle onChange={resolvedViewModeChange} value={resolvedViewMode} />
          )}
          {toolbar && <div className={resolvedViewModeChange ? 'sm:ml-auto' : 'w-full'}>{toolbar}</div>}
        </div>
      )}

      {notice && (
        <div className="app-border-soft app-surface-muted border-b px-5 py-3 text-sm font-bold">
          {notice}
        </div>
      )}

      {collectionContent}

      {footer && (
        <div className="app-border-soft app-muted border-t px-5 py-4 text-sm">
          {footer}
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
