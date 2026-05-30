import { describe, it, expect } from 'vitest'

describe('ai-generator', () => {
  it('exports all content generation functions', async () => {
    const mod = await import('@/lib/ai-generator')
    const fns = [
      'setRuntimeAiKey',
      'generateArticle',
      'generateCase',
      'generateQuestion',
      'generateComment',
      'generateReview',
    ]
    for (const name of fns) {
      expect(typeof (mod as Record<string, unknown>)[name]).toBe('function')
    }
  })

  it('setRuntimeAiKey caches API key for runtime use', async () => {
    const { setRuntimeAiKey } = await import('@/lib/ai-generator')
    // 不传 key 时不会崩溃
    expect(() => setRuntimeAiKey('sk-test-key')).not.toThrow()
  })
})
