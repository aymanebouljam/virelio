import { apiConfig } from '../api'

export type ProofDocument = {
  id: string
  expenseId: string
  originalName: string
  mimeType: string
  sizeBytes: number
  storagePath: string
  createdAt: string
}

export async function uploadExpenseProof(expenseId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return (await apiConfig({
    path: `expenses/${expenseId}/proofs`,
    method: 'POST',
    input: formData,
  })) as ProofDocument
}
