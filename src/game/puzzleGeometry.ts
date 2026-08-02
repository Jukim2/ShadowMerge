import * as THREE from 'three'
import levelData from '../content/levels/whale-001.json'
import type { PuzzleLevel } from '../content/levelSchema'

export const LEVEL = levelData as PuzzleLevel
export const PUZZLE_ID = LEVEL.id
export const PUZZLE_LABEL = LEVEL.label

export function createWhaleShape(): THREE.Shape {
  const shape = new THREE.Shape()

  shape.moveTo(-1.62, 0.08)
  shape.bezierCurveTo(-1.45, 0.67, -0.52, 0.94, 0.38, 0.78)
  shape.bezierCurveTo(0.86, 0.69, 1.16, 0.47, 1.34, 0.25)
  shape.lineTo(1.56, 0.63)
  shape.lineTo(1.72, 0.22)
  shape.lineTo(1.98, 0.02)
  shape.lineTo(1.68, -0.16)
  shape.lineTo(1.5, -0.61)
  shape.lineTo(1.25, -0.3)
  shape.bezierCurveTo(0.72, -0.76, -0.43, -0.82, -1.31, -0.38)
  shape.bezierCurveTo(-1.58, -0.24, -1.78, -0.05, -1.62, 0.08)

  return shape
}

export function createPuzzleGeometry(): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(createWhaleShape(), {
    depth: 0.9,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.07,
    bevelThickness: 0.08,
    curveSegments: 24,
    steps: 5,
  })

  geometry.translate(0, 0, -0.45)

  const positions = geometry.attributes.position as THREE.BufferAttribute
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index)
    const y = positions.getY(index)
    const z = positions.getZ(index)
    const depthWarp = 0.2 * Math.sin(x * 2.3 + y * 1.7) + 0.09 * Math.cos(y * 4.2 - x)
    positions.setZ(index, z + depthWarp)
  }

  positions.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

export function createInitialQuaternion(): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(...LEVEL.initialEuler, 'XYZ'))
}

export function createSolutionQuaternion(): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(...LEVEL.solutionEuler, 'XYZ'))
}
