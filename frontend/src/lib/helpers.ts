export function formatAmount(value: string) {
  const amount = Number(value)
  return Number.isNaN(amount) ? 'N/A' : amount.toFixed(2)
}

export function getInitials(fullName: string) {
  const nameParts = fullName.trim().split(/\s+/).filter(Boolean)
  if (nameParts.length === 0) return '?'

  const firstInitial = Array.from(nameParts[0] ?? '')[0] ?? ''

  const lastInitial =
    nameParts.length > 1 ? (Array.from(nameParts[nameParts.length - 1] ?? '')[0] ?? '') : ''

  return `${firstInitial}${lastInitial}`.toLocaleUpperCase()
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

export function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }

  const sizeKb = sizeBytes / 1024
  if (sizeKb < 1024) {
    return `${sizeKb.toFixed(1)} KB`
  }

  const sizeMb = sizeKb / 1024
  return `${sizeMb.toFixed(1)} MB`
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}
