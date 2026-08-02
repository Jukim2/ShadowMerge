import { describe, expect, it } from 'vitest'
import { compareRgbaMasks } from './maskSimilarity'

function mask(bits: number[]): Uint8Array {
  return new Uint8Array(bits.flatMap((value) => [value, value, value, 255]))
}

describe('compareRgbaMasks', () => {
  it('returns a perfect score for identical silhouettes', () => {
    const target = mask([255, 0, 255, 255])
    expect(compareRgbaMasks(target, target)).toMatchObject({ iou: 1, score: 100 })
  })

  it('uses intersection over union for partial overlap', () => {
    const target = mask([255, 255, 0, 0])
    const current = mask([0, 255, 255, 0])
    const result = compareRgbaMasks(target, current)
    expect(result.intersection).toBe(1)
    expect(result.union).toBe(3)
    expect(result.score).toBe(33.3)
  })

  it('rejects mismatched buffer sizes', () => {
    expect(() => compareRgbaMasks(mask([255]), mask([255, 0]))).toThrow(/equal RGBA/)
  })
})
