import { describe, it, expect } from 'vitest'
import { COVERS, ARTICLE_COVERS, AVATARS, getCover, getArticleCover } from '@/lib/images'

describe('images', () => {
  describe('COVERS', () => {
    it('has 8 interior design cover images', () => {
      expect(COVERS).toHaveLength(8)
    })

    it('all covers are valid Unsplash URLs with w=800', () => {
      for (const url of COVERS) {
        expect(url).toMatch(/^https:\/\/images\.unsplash\.com\//)
        expect(url).toContain('w=800')
      }
    })
  })

  describe('ARTICLE_COVERS', () => {
    it('has 3 article covers', () => {
      expect(ARTICLE_COVERS).toHaveLength(3)
    })
  })

  describe('AVATARS', () => {
    it('has 3 default avatars', () => {
      expect(AVATARS).toHaveLength(3)
    })
  })

  describe('getCover', () => {
    it('returns correct cover by index', () => {
      expect(getCover(0)).toBe(COVERS[0])
      expect(getCover(3)).toBe(COVERS[3])
      expect(getCover(7)).toBe(COVERS[7])
    })

    it('wraps around with modulo for positive indices', () => {
      expect(getCover(8)).toBe(COVERS[0])
      expect(getCover(10)).toBe(COVERS[2])
    })
  })

  describe('getArticleCover', () => {
    it('wraps around', () => {
      expect(getArticleCover(0)).toBe(ARTICLE_COVERS[0])
      expect(getArticleCover(3)).toBe(ARTICLE_COVERS[0])
      expect(getArticleCover(5)).toBe(ARTICLE_COVERS[2])
    })
  })
})
