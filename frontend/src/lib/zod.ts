type ValidationIssue = {
  path: PropertyKey[]
  message: string
}

export function mapZodErrors(issues: readonly ValidationIssue[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {}

  for (const issue of issues) {
    const field = issue.path[0]

    if (typeof field !== 'string' || field in fieldErrors) {
      continue
    }

    fieldErrors[field] = issue.message
  }

  return fieldErrors
}
