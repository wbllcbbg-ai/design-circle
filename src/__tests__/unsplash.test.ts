import { describe, it, expect } from 'vitest'
import { searchImages, getSearchQuery, setUnsplashKey } from '@/lib/unsplash'

describe('unsplash', () => {
  describe('getSearchQuery', () => {
    it('returns a design-related query string', () => {
      const q = getSearchQuery('article')
      expect(typeof q).toBe('string')
      expect(q.length).toBeGreaterThan(0)
    })

    it('returns different queries for different types', () => {
      const articleQ = getSearchQuery('article')
      const caseQ = getSearchQuery('case')
      expect(typeof articleQ).toBe('string')
      expect(typeof caseQ).toBe('string')
    })
  })

  describe('searchImages without API key', () => {
    it('returns placeholder images when no key is set', async () => {
      setUnsplashKey('') // clear key
      const images = await searchImages('modern kitchen', 3)
      expect(images).toHaveLength(3)
      for (const img of images) {
        expect(img).toContain('placehold.co')
      }
    })
  })

  describe('setUnsplashKey', () => {
    it('sets and uses runtime key', () => {
      expect(() => setUnsplashKey('test-key-123')).not.toThrow()
    })
  })
})
