interface FieldErrorProps {
  message?: string
}

export function FieldError({ message }: FieldErrorProps): JSX.Element | null {
  if (!message) {
    return null
  }

  return <p className="mt-1.5 text-xs font-semibold text-rose-600">{message}</p>
}
