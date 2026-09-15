interface LoadingStateProps {
  label: string
}

export function LoadingState({ label }: LoadingStateProps): JSX.Element {
  return (
    <div
      aria-live="polite"
      className="app-loading-state flex flex-col items-center justify-center gap-3 px-5 py-16 text-center"
      role="status"
    >
      <div aria-hidden="true" className="app-loading-orbit" />
      <p className="app-muted text-sm font-medium">{label}</p>
      <div aria-hidden="true" className="flex items-center gap-1.5">
        <span className="app-loading-dot" />
        <span className="app-loading-dot" />
        <span className="app-loading-dot" />
      </div>
    </div>
  )
}
