interface LoadingStateProps {
  label: string
}

export function LoadingState({ label }: LoadingStateProps): JSX.Element {
  return (
    <div className="px-5 py-16 text-center">
      <p className="app-muted text-sm font-medium">{label}</p>
    </div>
  )
}
