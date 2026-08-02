import * as THREE from 'three'
import {
  createInitialQuaternion,
  createSolutionQuaternion,
  LEVEL,
  PUZZLE_ID,
  PUZZLE_LABEL,
} from './puzzleGeometry'

export type GameMode = 'loading' | 'playing' | 'assisting' | 'complete'

export interface RuntimeSnapshot {
  mode: GameMode
  coordinateSystem: string
  puzzle: { id: string; hiddenSilhouette: string }
  rotation: { quaternion: [number, number, number, number]; eulerDegrees: [number, number, number] }
  score: number
  completionThreshold: number
  holdMs: number
  holdRequiredMs: number
  dragging: boolean
  hintUsed: boolean
}

type Listener = (snapshot: RuntimeSnapshot) => void

export class PuzzleRuntime {
  readonly rotation = createInitialQuaternion()
  readonly solution = createSolutionQuaternion()
  readonly completionThreshold = LEVEL.scoring.completionScore
  readonly holdRequiredMs = LEVEL.scoring.holdDurationMs

  private mode: GameMode = 'loading'
  private score = 0
  private holdMs = 0
  private dragging = false
  private hintUsed = false
  private listeners = new Set<Listener>()

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => this.listeners.delete(listener)
  }

  setReady(initialScore: number): void {
    if (this.mode !== 'loading') return
    this.mode = 'playing'
    this.score = initialScore
    this.emit()
  }

  setScore(score: number): void {
    const previousScore = this.score
    this.score = score
    if (score < this.completionThreshold && this.mode === 'complete') {
      this.mode = 'playing'
    }
    if (previousScore !== score) this.emit()
  }

  setDragging(value: boolean): void {
    this.dragging = value
    this.emit()
  }

  rotateByPointer(deltaX: number, deltaY: number): void {
    if (this.mode === 'loading' || this.mode === 'complete') return
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * 0.008)
    const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deltaY * 0.008)
    this.rotation.premultiply(yaw).premultiply(pitch).normalize()
    this.holdMs = 0
  }

  assist(): void {
    if (this.mode === 'loading' || this.mode === 'complete') return
    this.mode = 'assisting'
    this.hintUsed = true
    this.dragging = false
    this.emit()
  }

  reset(): void {
    this.rotation.copy(createInitialQuaternion())
    this.mode = 'playing'
    this.score = 0
    this.holdMs = 0
    this.dragging = false
    this.hintUsed = false
    this.emit()
  }

  advance(ms: number): void {
    const previousMode = this.mode
    const previousHoldBucket = Math.floor(this.holdMs / 50)

    if (this.mode === 'assisting') {
      const factor = 1 - Math.exp(-ms / 115)
      this.rotation.slerp(this.solution, factor)
      if (this.rotation.angleTo(this.solution) < 0.002) {
        this.rotation.copy(this.solution)
        this.mode = 'playing'
      }
    }

    if (this.score >= this.completionThreshold && this.mode !== 'loading') {
      this.holdMs += ms
      if (this.holdMs >= this.holdRequiredMs) {
        this.mode = 'complete'
        this.holdMs = this.holdRequiredMs
      }
    } else {
      this.holdMs = 0
    }

    const holdBucket = Math.floor(this.holdMs / 50)
    if (previousMode !== this.mode || previousHoldBucket !== holdBucket) this.emit()
  }

  snapshot(): RuntimeSnapshot {
    const euler = new THREE.Euler().setFromQuaternion(this.rotation, 'XYZ')
    const degrees = (radians: number) => Math.round(THREE.MathUtils.radToDeg(radians) * 10) / 10

    return {
      mode: this.mode,
      coordinateSystem: 'right-handed world; +X right, +Y up, +Z toward viewer; shadow projects toward -Z',
      puzzle: { id: PUZZLE_ID, hiddenSilhouette: PUZZLE_LABEL },
      rotation: {
        quaternion: [this.rotation.x, this.rotation.y, this.rotation.z, this.rotation.w].map(
          (value) => Math.round(value * 10000) / 10000,
        ) as [number, number, number, number],
        eulerDegrees: [degrees(euler.x), degrees(euler.y), degrees(euler.z)],
      },
      score: this.score,
      completionThreshold: this.completionThreshold,
      holdMs: Math.round(this.holdMs),
      holdRequiredMs: this.holdRequiredMs,
      dragging: this.dragging,
      hintUsed: this.hintUsed,
    }
  }

  private emit(): void {
    const snapshot = this.snapshot()
    this.listeners.forEach((listener) => listener(snapshot))
  }
}
