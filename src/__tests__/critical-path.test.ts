import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const appDir = path.resolve(__dirname, '../app')
const apiDir = path.resolve(__dirname, '../app/api')

// 关键业务路径存在性验证
describe('Critical business path: Home → Discover → Detail → Review', () => {
  it('step 1: homepage exists with feed API', () => {
    expect(fs.existsSync(path.join(appDir, 'page.tsx'))).toBe(true)
    expect(fs.existsSync(path.join(apiDir, 'feed', 'route.ts'))).toBe(true)
  })

  it('step 2: designer list page exists with API', () => {
    expect(fs.existsSync(path.join(appDir, 'designers', 'page.tsx'))).toBe(true)
    expect(fs.existsSync(path.join(apiDir, 'designers', 'route.ts'))).toBe(true)
  })

  it('step 3: designer detail page exists with [id] route', () => {
    expect(fs.existsSync(path.join(appDir, 'designers', '[id]', 'page.tsx'))).toBe(true)
    expect(fs.existsSync(path.join(apiDir, 'designers', '[id]', 'route.ts'))).toBe(true)
  })

  it('step 4: case detail page exists with reviews API', () => {
    expect(fs.existsSync(path.join(appDir, 'cases', '[id]', 'page.tsx'))).toBe(true)
    expect(fs.existsSync(path.join(apiDir, 'cases', '[id]', 'reviews', 'route.ts'))).toBe(true)
  })

  it('step 5: review creation API exists', () => {
    expect(fs.existsSync(path.join(apiDir, 'reviews', 'route.ts'))).toBe(true)
  })

  it('step 6: publish flow exists', () => {
    expect(fs.existsSync(path.join(appDir, 'publish', 'page.tsx'))).toBe(true)
    expect(fs.existsSync(path.join(apiDir, 'cases', 'route.ts'))).toBe(true)
  })
})

describe('User journey: Login → Apply → Approval', () => {
  it('login page exists', () => {
    expect(fs.existsSync(path.join(appDir, 'login'))).toBe(true)
  })

  it('designer application page exists', () => {
    expect(fs.existsSync(path.join(appDir, 'apply'))).toBe(true)
  })

  it('application API exists', () => {
    expect(fs.existsSync(path.join(apiDir, 'apply', 'route.ts'))).toBe(true)
  })

  it('admin applications review exists', () => {
    expect(fs.existsSync(path.join(appDir, 'admin', 'applications', 'page.tsx'))).toBe(true)
    expect(fs.existsSync(path.join(apiDir, 'admin', 'applications', 'route.ts'))).toBe(true)
  })
})

describe('Engagement loop: Like → Favorite → Notify', () => {
  it('likes API exists', () => {
    expect(fs.existsSync(path.join(apiDir, 'likes', 'route.ts'))).toBe(true)
  })

  it('favorites API exists', () => {
    expect(fs.existsSync(path.join(apiDir, 'favorites', 'route.ts'))).toBe(true)
  })

  it('notifications API exists', () => {
    expect(fs.existsSync(path.join(apiDir, 'notifications', 'route.ts'))).toBe(true)
  })

  it('notification page exists', () => {
    expect(fs.existsSync(path.join(appDir, 'notifications', 'page.tsx'))).toBe(true)
  })
})

describe('AI content pipeline', () => {
  it('virtual users CRUD API exists', () => {
    expect(fs.existsSync(path.join(apiDir, 'admin', 'virtual-users', 'route.ts'))).toBe(true)
  })

  it('batch generation API exists', () => {
    expect(fs.existsSync(path.join(apiDir, 'admin', 'generate-content', 'route.ts'))).toBe(true)
  })

  it('AI generator lib is importable', async () => {
    const mod = await import('@/lib/ai-generator')
    expect(mod).toBeDefined()
  })

  it('Unsplash lib is importable', async () => {
    const mod = await import('@/lib/unsplash')
    expect(mod).toBeDefined()
  })
})
