interface EmptyStateProps {
  title: string
  description?: string
}

export function EmptyState({ description, title }: EmptyStateProps): JSX.Element {
  return (
    <div className="px-5 py-16 text-center">
      <p className="app-text text-base font-black">{title}</p>
      {description && <p className="app-muted mt-2 text-sm">{description}</p>}
    </div>
  )
}
