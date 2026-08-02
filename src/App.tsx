import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import PuzzleScene from './PuzzleScene'
import { PuzzleRuntime, type RuntimeSnapshot } from './game/runtime'

declare global {
  interface Window {
    render_game_to_text: () => string
    advanceTime: (ms: number) => void
  }
}

function App() {
  const runtime = useMemo(() => new PuzzleRuntime(), [])
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>(() => runtime.snapshot())
  const pointerRef = useRef<{ id: number; x: number; y: number } | null>(null)

  useEffect(() => runtime.subscribe(setSnapshot), [runtime])

  useEffect(() => {
    window.render_game_to_text = () => JSON.stringify(runtime.snapshot())
    window.advanceTime = (ms: number) => runtime.advance(ms)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') runtime.reset()
      if (event.key.toLowerCase() === 'h' || event.key === ' ') {
        event.preventDefault()
        runtime.assist()
      }
      if (event.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) void document.exitFullscreen()
        else void document.documentElement.requestFullscreen()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [runtime])

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (snapshot.mode === 'loading' || snapshot.mode === 'complete') return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    runtime.setDragging(true)
  }

  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = pointerRef.current
    if (!active || active.id !== event.pointerId) return
    runtime.rotateByPointer(event.clientX - active.x, event.clientY - active.y)
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }

  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current?.id !== event.pointerId) return
    pointerRef.current = null
    runtime.setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const score = Math.round(snapshot.score)
  const completed = snapshot.mode === 'complete'

  return (
    <main className="app-shell">
      <section
        className={`game-frame ${snapshot.dragging ? 'is-dragging' : ''}`}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        <Canvas
          dpr={[1, 1.7]}
          camera={{ position: [4.35, 2.4, 7.6], fov: 38, near: 0.1, far: 30 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          <PuzzleScene runtime={runtime} />
        </Canvas>

        <header className="top-bar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <div>
              <strong>UMBRA</strong>
              <span>OBSERVATORY · 01</span>
            </div>
          </div>
          <button className="icon-button" type="button" onClick={() => runtime.reset()} aria-label="퍼즐 다시 시작">
            ↻
          </button>
        </header>

        <aside className="score-card" aria-live="polite">
          <span>ALIGNMENT</span>
          <strong>{snapshot.mode === 'loading' ? '—' : `${score}%`}</strong>
          <div className="meter">
            <i style={{ width: `${score}%` }} />
          </div>
        </aside>

        <footer className="control-deck">
          <div className="instruction">
            <span className="gesture-icon" aria-hidden="true">↔</span>
            <div>
              <strong>{completed ? '형상이 깨어났습니다' : '조형물을 회전하세요'}</strong>
              <span>{completed ? '숨은 고래를 발견했습니다' : '빛 속에 감춰진 실루엣을 찾으세요'}</span>
            </div>
          </div>
          <button
            className="assist-button"
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => runtime.assist()}
            disabled={snapshot.mode === 'loading' || completed}
          >
            <span>ASSIST</span>
            <small>H</small>
          </button>
        </footer>

        {snapshot.mode === 'loading' && (
          <div className="loading-layer">
            <span />
            <p>빛을 조율하는 중</p>
          </div>
        )}

        {completed && (
          <div className="complete-layer">
            <span>DISCOVERED</span>
            <h1>고래</h1>
            <p>깊은 밤을 헤엄치는 빛의 기억</p>
            <button type="button" onClick={() => runtime.reset()}>다시 관찰하기</button>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
