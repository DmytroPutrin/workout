import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getApiErrorMessage, getApiFieldErrors, safeRedirect } from '../../app/utils/api-error'

describe('safeRedirect', () => {
  it('allows paths inside the app', () => {
    assert.equal(safeRedirect('/history'), '/history')
    assert.equal(safeRedirect('/progress?exercise=3'), '/progress?exercise=3')
  })

  it('blocks open redirects to other sites', () => {
    for (const target of ['https://evil.example', '//evil.example', 'evil.example', 'javascript:alert(1)', '']) {
      assert.equal(safeRedirect(target), '/', target)
    }
  })

  it('falls back for non-strings (e.g. ?redirect=a&redirect=b gives an array)', () => {
    assert.equal(safeRedirect(['/a', '/b']), '/')
    assert.equal(safeRedirect(undefined, '/home'), '/home')
  })
})

describe('getApiErrorMessage / getApiFieldErrors', () => {
  // The shape $fetch throws: the response body is on error.data
  const validationError = {
    data: {
      statusCode: 400,
      message: 'Enter a valid email address',
      data: { fieldErrors: { email: ['Enter a valid email address', 'second message'], password: [] } },
    },
  }

  it('reads the message from the response body', () => {
    assert.equal(getApiErrorMessage(validationError), 'Enter a valid email address')
  })

  it('falls back when there is no body (e.g. network error)', () => {
    assert.equal(getApiErrorMessage(new Error('fetch failed')), 'Something went wrong. Please try again.')
    assert.equal(getApiErrorMessage(null, 'Custom'), 'Custom')
  })

  it('returns the first message per field and skips empty fields', () => {
    assert.deepEqual(getApiFieldErrors(validationError), { email: 'Enter a valid email address' })
    assert.deepEqual(getApiFieldErrors({}), {})
  })
})
