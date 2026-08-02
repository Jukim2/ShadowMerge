import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { compareRgbaMasks } from './game/maskSimilarity'
import { createPuzzleGeometry, LEVEL } from './game/puzzleGeometry'
import { PuzzleRuntime } from './game/runtime'

interface PuzzleSceneProps {
  runtime: PuzzleRuntime
}

const MASK_SIZE = LEVEL.maskSize

const wallVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const wallFragmentShader = /* glsl */ `
  uniform sampler2D maskMap;
  uniform float completed;
  varying vec2 vUv;

  void main() {
    vec2 centered = vUv - 0.5;
    float vignette = smoothstep(0.78, 0.18, length(centered));
    float mask = texture2D(maskMap, vUv).r;
    vec3 parchment = vec3(0.78, 0.71, 0.58) * (0.72 + vignette * 0.3);
    vec3 shadow = vec3(0.055, 0.085, 0.11);
    vec3 awakened = vec3(0.12, 0.42, 0.48);
    vec3 ink = mix(shadow, awakened, completed);
    vec3 color = mix(parchment, ink, smoothstep(0.08, 0.72, mask) * 0.88);
    gl_FragColor = vec4(color, 1.0);
  }
`

export default function PuzzleScene({ runtime }: PuzzleSceneProps) {
  const { gl, camera } = useThree()
  const visualRef = useRef<THREE.Group>(null)
  const initializedRef = useRef(false)
  const targetPixelsRef = useRef<Uint8Array | null>(null)
  const currentPixelsRef = useRef(new Uint8Array(MASK_SIZE * MASK_SIZE * 4))
  const scoreTimerRef = useRef(0)
  const previousModeRef = useRef(runtime.snapshot().mode)

  const geometry = useMemo(() => createPuzzleGeometry(), [])
  const maskGeometry = useMemo(() => geometry.clone(), [geometry])
  const maskMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff }), [])
  const maskMesh = useMemo(() => new THREE.Mesh(maskGeometry, maskMaterial), [maskGeometry, maskMaterial])
  const maskScene = useMemo(() => {
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    scene.add(maskMesh)
    return scene
  }, [maskMesh])
  const maskCamera = useMemo(() => {
    const result = new THREE.OrthographicCamera(-2.45, 2.45, 2.05, -2.05, 0.1, 10)
    result.position.set(0, 0, 5)
    result.lookAt(0, 0, 0)
    return result
  }, [])
  const maskTarget = useMemo(
    () =>
      new THREE.WebGLRenderTarget(MASK_SIZE, MASK_SIZE, {
        depthBuffer: true,
        stencilBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      }),
    [],
  )
  const targetTarget = useMemo(
    () =>
      new THREE.WebGLRenderTarget(MASK_SIZE, MASK_SIZE, {
        depthBuffer: true,
        stencilBuffer: false,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
      }),
    [],
  )
  const wallMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          maskMap: { value: maskTarget.texture },
          completed: { value: 0 },
        },
        vertexShader: wallVertexShader,
        fragmentShader: wallFragmentShader,
      }),
    [maskTarget.texture],
  )

  useEffect(() => {
    camera.lookAt(0, 0.05, -1.15)
  }, [camera])

  useEffect(
    () => () => {
      geometry.dispose()
      maskGeometry.dispose()
      maskMaterial.dispose()
      maskTarget.dispose()
      targetTarget.dispose()
      wallMaterial.dispose()
    }, [geometry, maskGeometry, maskMaterial, maskTarget, targetTarget, wallMaterial],
  )

  useFrame((_, delta) => {
    const safeDeltaMs = Math.min(delta * 1000, 50)
    runtime.advance(safeDeltaMs)
    const snapshot = runtime.snapshot()

    if (!initializedRef.current) {
      maskMesh.quaternion.identity()
      gl.setRenderTarget(targetTarget)
      gl.clear()
      gl.render(maskScene, maskCamera)
      const targetPixels = new Uint8Array(MASK_SIZE * MASK_SIZE * 4)
      gl.readRenderTargetPixels(targetTarget, 0, 0, MASK_SIZE, MASK_SIZE, targetPixels)
      targetPixelsRef.current = targetPixels
      initializedRef.current = true
    }

    if (visualRef.current) visualRef.current.quaternion.copy(runtime.rotation)
    maskMesh.quaternion.copy(runtime.rotation)

    gl.setRenderTarget(maskTarget)
    gl.clear()
    gl.render(maskScene, maskCamera)
    gl.setRenderTarget(null)

    scoreTimerRef.current += safeDeltaMs
    if (scoreTimerRef.current >= 80 && targetPixelsRef.current) {
      scoreTimerRef.current = 0
      gl.readRenderTargetPixels(
        maskTarget,
        0,
        0,
        MASK_SIZE,
        MASK_SIZE,
        currentPixelsRef.current,
      )
      const similarity = compareRgbaMasks(targetPixelsRef.current, currentPixelsRef.current)
      runtime.setScore(similarity.score)
      if (snapshot.mode === 'loading') runtime.setReady(similarity.score)
    }

    const currentMode = runtime.snapshot().mode
    if (currentMode !== previousModeRef.current) previousModeRef.current = currentMode
    wallMaterial.uniforms.completed.value = THREE.MathUtils.lerp(
      wallMaterial.uniforms.completed.value as number,
      currentMode === 'complete' ? 1 : 0,
      0.08,
    )
  }, -1)

  return (
    <>
      <color attach="background" args={['#101925']} />
      <fog attach="fog" args={['#101925', 7, 18]} />

      <ambientLight intensity={0.42} color="#7f93a8" />
      <directionalLight position={[4, 6, 6]} intensity={2.4} color="#f3d7a5" />
      <pointLight position={[-3, 1.2, 2]} intensity={11} distance={9} color="#3e8ca0" />

      <mesh position={[0, 0, -2.55]} material={wallMaterial}>
        <planeGeometry args={[5.2, 4.35]} />
      </mesh>
      <mesh position={[0, -2.24, -1.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#17222d" roughness={0.93} metalness={0.03} />
      </mesh>

      <group ref={visualRef} position={[0, 0, 0.12]}>
        <mesh geometry={geometry} castShadow>
          <meshStandardMaterial color="#9c6c3f" roughness={0.27} metalness={0.72} />
        </mesh>
        <mesh geometry={geometry} scale={1.018}>
          <meshBasicMaterial color="#dba869" wireframe transparent opacity={0.11} />
        </mesh>
      </group>

      <mesh position={[0, -1.17, -0.1]}>
        <cylinderGeometry args={[0.72, 1.02, 0.32, 64]} />
        <meshStandardMaterial color="#192531" roughness={0.31} metalness={0.78} />
      </mesh>
      <mesh position={[0, -1.34, -0.1]}>
        <cylinderGeometry args={[1.02, 1.12, 0.12, 64]} />
        <meshStandardMaterial color="#72583b" roughness={0.48} metalness={0.56} />
      </mesh>

      <mesh position={[-2.36, 0, -2.28]}>
        <boxGeometry args={[0.16, 4.5, 0.26]} />
        <meshStandardMaterial color="#654a32" roughness={0.58} metalness={0.42} />
      </mesh>
      <mesh position={[2.36, 0, -2.28]}>
        <boxGeometry args={[0.16, 4.5, 0.26]} />
        <meshStandardMaterial color="#654a32" roughness={0.58} metalness={0.42} />
      </mesh>
      <mesh position={[0, 2.08, -2.28]}>
        <boxGeometry args={[4.88, 0.16, 0.26]} />
        <meshStandardMaterial color="#654a32" roughness={0.58} metalness={0.42} />
      </mesh>
    </>
  )
}
