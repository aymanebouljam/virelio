export function formatAmount(value: string) {
  const amount = Number(value)
  return Number.isNaN(amount) ? 'N/A' : amount.toFixed(2)
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}
