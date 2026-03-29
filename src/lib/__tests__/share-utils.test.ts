import { describe, it, expect, vi } from 'vitest'
import { generateShareToken } from '../share-utils'

describe('generateShareToken', () => {
  it('generates a token of exactly 12 characters', () => {
    const token = generateShareToken()
    expect(token).toHaveLength(12)
  })

  it('generates only alphanumeric characters', () => {
    const token = generateShareToken()
    expect(token).toMatch(/^[A-Za-z0-9]{12}$/)
  })

  it('generates unique tokens across multiple calls', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateShareToken()))
    expect(tokens.size).toBe(100)
  })

  it('uses crypto.getRandomValues not Math.random', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues')
    generateShareToken()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
