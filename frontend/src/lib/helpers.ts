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

export function formatRelativeDate(value: string, now = Date.now()) {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'Invalid date'

  const differenceInSeconds = (timestamp - now) / 1000
  const absoluteSeconds = Math.abs(differenceInSeconds)
  if (absoluteSeconds < 60) return 'just now'

  const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'always' })

  if (absoluteSeconds < 60 * 60) {
    return relativeTime.format(Math.round(differenceInSeconds / 60), 'minute')
  }

  if (absoluteSeconds < 60 * 60 * 24) {
    return relativeTime.format(Math.round(differenceInSeconds / (60 * 60)), 'hour')
  }

  if (absoluteSeconds < 60 * 60 * 24 * 30) {
    return relativeTime.format(Math.round(differenceInSeconds / (60 * 60 * 24)), 'day')
  }

  if (absoluteSeconds < 60 * 60 * 24 * 365) {
    return relativeTime.format(Math.round(differenceInSeconds / (60 * 60 * 24 * 30.44)), 'month')
  }

  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
