export interface PuzzleLevel {
  id: string
  label: string
  chapter: string
  themeId: string
  seed: number
  maskSize: number
  initialEuler: [number, number, number]
  solutionEuler: [number, number, number]
  scoring: {
    completionScore: number
    holdDurationMs: number
  }
  hints: string[]
}
