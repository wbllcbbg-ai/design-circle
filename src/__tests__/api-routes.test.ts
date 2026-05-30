import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const apiDir = path.resolve(__dirname, '../app/api')

function findRouteFiles(dir: string): string[] {
  const files: string[] = []
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...findRouteFiles(full))
    } else if (entry.name === 'route.ts') {
      files.push(full)
    }
  }
  return files
}

describe('API route structure', () => {
  const routeFiles = findRouteFiles(apiDir)

  it('has at least 30 API route files', () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(30)
  })

  it('feed endpoint exists and is a valid module', () => {
    expect(fs.existsSync(path.join(apiDir, 'feed', 'route.ts'))).toBe(true)
  })

  it('search endpoint exists', () => {
    expect(fs.existsSync(path.join(apiDir, 'search', 'route.ts'))).toBe(true)
  })

  it('all admin endpoints exist', () => {
    const adminEndpoints = ['applications', 'reviews', 'virtual-users', 'reward-rules', 'ai-config', 'generate-content']
    for (const ep of adminEndpoints) {
      const routePath = path.join(apiDir, 'admin', ep, 'route.ts')
      expect(fs.existsSync(routePath)).toBe(true)
    }
  })
})

describe('API endpoints coverage', () => {
  const expectedEndpoints = [
    'articles', 'cases', 'comments', 'conversations', 'designers',
    'favorites', 'feed', 'invite', 'likes', 'notifications',
    'points', 'profile', 'questions', 'reviews', 'search',
    'tags', 'upload', 'users',
  ]

  for (const ep of expectedEndpoints) {
    it(`has /api/${ep} endpoint`, () => {
      expect(fs.existsSync(path.join(apiDir, ep))).toBe(true)
    })
  }
})

describe('App page routes', () => {
  const appDir = path.resolve(__dirname, '../app')
  const expectedPages = [
    'page.tsx',           // /
    'admin', 'apply', 'articles', 'cases', 'city',
    'dashboard', 'designers', 'invite', 'login', 'messages',
    'notifications', 'points', 'profile', 'publish', 'search',
    'tags', 'users',
  ]

  for (const page of expectedPages) {
    it(`has /${page === 'page.tsx' ? '' : page} page`, () => {
      const p = path.join(appDir, page)
      expect(fs.existsSync(p)).toBe(true)
    })
  }
})
