export interface MaskSimilarity {
  intersection: number
  union: number
  targetPixels: number
  currentPixels: number
  iou: number
  precision: number
  recall: number
  score: number
}

export function compareRgbaMasks(
  target: Uint8Array,
  current: Uint8Array,
  threshold = 127,
): MaskSimilarity {
  if (target.length !== current.length || target.length % 4 !== 0) {
    throw new Error('Mask buffers must have equal RGBA dimensions.')
  }

  let intersection = 0
  let union = 0
  let targetPixels = 0
  let currentPixels = 0

  for (let index = 0; index < target.length; index += 4) {
    const targetOn = target[index] > threshold
    const currentOn = current[index] > threshold

    if (targetOn) targetPixels += 1
    if (currentOn) currentPixels += 1
    if (targetOn && currentOn) intersection += 1
    if (targetOn || currentOn) union += 1
  }

  const iou = union === 0 ? 1 : intersection / union
  const precision = currentPixels === 0 ? 0 : intersection / currentPixels
  const recall = targetPixels === 0 ? 0 : intersection / targetPixels

  return {
    intersection,
    union,
    targetPixels,
    currentPixels,
    iou,
    precision,
    recall,
    score: Math.round(iou * 1000) / 10,
  }
}
