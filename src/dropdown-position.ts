export function getDropdownPlacement(
  trigger: { top: number; bottom: number; right: number; width: number },
  viewport: { top: number; left: number; width: number; height: number },
  desiredHeight: number,
): { top: number; left: number; width: number; maxHeight: number } {
  const topEdge = viewport.top + 12
  const bottomEdge = viewport.top + viewport.height - 12
  const leftEdge = viewport.left + 12
  const availableWidth = Math.max(0, viewport.width - 24)
  const availableHeight = Math.max(0, viewport.height - 24)
  const width = Math.min(Math.max(190, trigger.width), availableWidth)
  const wantedHeight = Math.min(480, Math.max(0, desiredHeight))
  const below = Math.max(0, bottomEdge - trigger.bottom - 7)
  const above = Math.max(0, trigger.top - 7 - topEdge)
  const openBelow = wantedHeight <= below || below >= above
  const maxHeight = Math.min(wantedHeight, openBelow ? below : above, availableHeight)
  const preferredTop = openBelow ? trigger.bottom + 7 : trigger.top - 7 - maxHeight

  return {
    top: Math.max(topEdge, Math.min(preferredTop, bottomEdge - maxHeight)),
    left: Math.max(leftEdge, Math.min(trigger.right - width, leftEdge + availableWidth - width)),
    width,
    maxHeight,
  }
}
