import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ApiError } from '@/lib/api'
import { useFormErrors } from '@/lib/use-form-errors'

describe('useFormErrors', () => {
  let formErrors: ReturnType<typeof useFormErrors>['formErrors']
  let submitError: ReturnType<typeof useFormErrors>['submitError']
  let clearErrors: ReturnType<typeof useFormErrors>['clearErrors']
  let setError: ReturnType<typeof useFormErrors>['setError']

  beforeEach(() => {
    ;({ formErrors, submitError, clearErrors, setError } = useFormErrors())
  })

  it('stores API field errors', () => {
    setError(new ApiError('invalid form input', { email: 'Email is already registered' }))

    expect(formErrors.value).toEqual({ email: 'Email is already registered' })
    expect(submitError.value).toBe('')
  })

  it('maps Zod issues to field errors', () => {
    const schema = z.object({ email: z.email('Email must be valid') })

    try {
      schema.parse({ email: 'invalid' })
    } catch (error) {
      setError(error)
    }

    expect(formErrors.value).toEqual({ email: 'Email must be valid' })
  })

  it('stores non-field errors', () => {
    setError(new ApiError('Service unavailable'))
    expect(submitError.value).toBe('Service unavailable')
  })

  it('defaults to a generic message for an unspecified error type', () => {
    setError(new Error('Network error'))
    expect(submitError.value).toBe('Something went wrong')
  })

  it('clears both error types', () => {
    formErrors.value = { email: 'Email is already registered' }
    submitError.value = 'Internal server error'
    clearErrors()

    expect(formErrors.value).toEqual({})
    expect(submitError.value).toBe('')
  })
})
