import { ref } from 'vue'
import { ZodError } from 'zod'
import { ApiError } from './api'
import { mapZodErrors } from './zod'

export function useFormErrors() {
  const formErrors = ref<Record<string, string>>({})
  const submitError = ref('')

  function clearErrors() {
    formErrors.value = {}
    submitError.value = ''
  }

  function setError(error: unknown) {
    if (error instanceof ApiError) {
      if (error.content) {
        formErrors.value = error.content
        return
      }

      submitError.value = error.message
      return
    }

    if (error instanceof ZodError) {
      formErrors.value = mapZodErrors(error.issues)
      return
    }

    submitError.value = 'Something went wrong'
  }

  return { formErrors, submitError, clearErrors, setError }
}
