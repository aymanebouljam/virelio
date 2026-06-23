export function formatAmount(value: string) {
  const amount = Number(value)
  return Number.isNaN(amount) ? 'N/A' : amount.toFixed(2)
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

export function getProofUrl(storagePath: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL

  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL is not defined')
  }

  return `${baseUrl.replace(/\/$/, '')}/${storagePath.replace(/^\/+/, '')}`
}
