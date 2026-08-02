import { describe, expect, it } from 'vitest'
import { PuzzleRuntime } from './runtime'

describe('PuzzleRuntime', () => {
  it('starts from a deterministic unsolved rotation', () => {
    const first = new PuzzleRuntime()
    const second = new PuzzleRuntime()
    expect(first.snapshot().rotation.quaternion).toEqual(second.snapshot().rotation.quaternion)
    expect(first.rotation.angleTo(first.solution)).toBeGreaterThan(0.5)
  })

  it('assistant converges to the authored solution', () => {
    const runtime = new PuzzleRuntime()
    runtime.setReady(20)
    runtime.assist()
    for (let frame = 0; frame < 100; frame += 1) runtime.advance(16.6667)
    expect(runtime.rotation.angleTo(runtime.solution)).toBeLessThan(0.002)
    expect(runtime.snapshot().hintUsed).toBe(true)
  })

  it('requires a sustained matching score before completion', () => {
    const runtime = new PuzzleRuntime()
    runtime.setReady(10)
    runtime.setScore(runtime.completionThreshold)
    runtime.advance(runtime.holdRequiredMs - 1)
    expect(runtime.snapshot().mode).not.toBe('complete')
    runtime.advance(1)
    expect(runtime.snapshot().mode).toBe('complete')
  })

  it('reset restores the initial state after using assistance', () => {
    const runtime = new PuzzleRuntime()
    const initial = runtime.snapshot().rotation.quaternion
    runtime.setReady(5)
    runtime.assist()
    runtime.advance(1000)
    runtime.reset()
    expect(runtime.snapshot()).toMatchObject({ mode: 'playing', score: 0, hintUsed: false })
    expect(runtime.snapshot().rotation.quaternion).toEqual(initial)
  })
})
