import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Stars } from '@/components/ui/stars'
import { Badge } from '@/components/ui/badge'

describe('Stars', () => {
  it('renders 5 star elements', () => {
    const { container } = render(<Stars rating={3} />)
    const stars = container.querySelectorAll('span > span, span > span > span')
    // 3 full + 2 empty = 5 stars worth of spans (full stars and empty stars)
    const starSpans = container.querySelectorAll('.text-amber-400, .text-zinc-300')
    expect(starSpans.length).toBeGreaterThanOrEqual(5)
  })

  it('shows numeric value when showValue is true', () => {
    render(<Stars rating={4.5} showValue />)
    expect(screen.getByText('4.5')).toBeInTheDocument()
  })

  it('does not show value when showValue is false', () => {
    const { container } = render(<Stars rating={4.5} />)
    expect(container.textContent).not.toContain('4.5')
  })

  it('renders half star for fractional ratings >= 0.5', () => {
    const { container } = render(<Stars rating={3.5} />)
    // Half star uses overflow-hidden with w-1/2
    const halfStar = container.querySelector('.overflow-hidden')
    expect(halfStar).toBeTruthy()
  })

  it('renders full stars only for integer ratings', () => {
    const { container } = render(<Stars rating={5} />)
    const fullStars = container.querySelectorAll('.text-amber-400')
    // 5 full stars as direct spans
    expect(fullStars.length).toBeGreaterThanOrEqual(5)
    const halfStar = container.querySelector('.overflow-hidden')
    expect(halfStar).toBeNull()
  })

  it('renders different sizes', () => {
    const { container: sm } = render(<Stars rating={3} size="sm" />)
    const { container: lg } = render(<Stars rating={3} size="lg" />)
    expect(sm.querySelector('.text-sm')).toBeTruthy()
    expect(lg.querySelector('.text-2xl')).toBeTruthy()
  })
})

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>设计师</Badge>)
    expect(screen.getByText('设计师')).toBeInTheDocument()
  })

  it('applies variant classes', () => {
    const { container } = render(<Badge variant="success">通过</Badge>)
    expect(container.firstChild).toHaveClass('bg-green-100')
  })

  it('default variant is "default"', () => {
    const { container } = render(<Badge>默认</Badge>)
    expect(container.firstChild).toHaveClass('bg-zinc-900')
  })

  it('merges custom className', () => {
    const { container } = render(<Badge className="ml-2">test</Badge>)
    expect(container.firstChild).toHaveClass('ml-2')
  })
})
