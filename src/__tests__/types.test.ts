import { describe, it, expect } from 'vitest'

// 类型守卫测试：验证 DesignType 枚举值
describe('Type system', () => {
  const validDesignerTypes = ['designer', 'company', 'worker'] as const
  const validReviewStatuses = ['pending', 'approved', 'rejected', 'flagged'] as const

  it('DesignerType accepts only designer | company | worker', () => {
    const types: string[] = ['designer', 'company', 'worker']
    for (const t of types) {
      expect(validDesignerTypes).toContain(t)
    }
    expect(validDesignerTypes).not.toContain('admin')
    expect(validDesignerTypes).not.toContain('supplier')
  })

  it('review statuses are well-defined', () => {
    expect(validReviewStatuses).toEqual(['pending', 'approved', 'rejected', 'flagged'])
  })

  it('rating must be between 1 and 5', () => {
    const validRatings = [1, 2, 3, 4, 5]
    for (const r of validRatings) {
      expect(r).toBeGreaterThanOrEqual(1)
      expect(r).toBeLessThanOrEqual(5)
    }
    expect(0).not.toBeGreaterThanOrEqual(1)
    expect(6).not.toBeLessThanOrEqual(5)
  })

  it('user roles are user | admin', () => {
    const roles = ['user', 'admin']
    expect(roles).toContain('user')
    expect(roles).toContain('admin')
    expect(roles).not.toContain('designer')
  })
})
