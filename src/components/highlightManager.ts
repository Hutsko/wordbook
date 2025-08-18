export type Highlight = {
  id: string
  cfiRange: string
  text: string
}

export type AnnotationsApi = {
  remove: (cfiRange: string, type: 'highlight') => void
  highlight: (
    cfiRange: string,
    data: Record<string, unknown>,
    onClick: (e: MouseEvent) => void,
    className: string
  ) => void
}

export function applyActiveState(
  annotations: AnnotationsApi,
  highlight: Highlight,
  isActive: boolean,
  onClick: (e: MouseEvent) => void
): void {
  try {
    annotations.remove(highlight.cfiRange, 'highlight')
  } catch {}
  annotations.highlight(
    highlight.cfiRange,
    {},
    onClick,
    isActive ? 'hl-active' : 'hl'
  )
}

export function toggleActiveHighlight(
  annotations: AnnotationsApi,
  currentActive: Highlight | null,
  clicked: Highlight,
  onClick: (h: Highlight) => (e: MouseEvent) => void
): Highlight | null {
  const isSame = currentActive?.id === clicked.id

  if (currentActive && !isSame) {
    applyActiveState(annotations, currentActive, false, onClick(currentActive))
  }

  if (isSame) {
    applyActiveState(annotations, clicked, false, onClick(clicked))
    return null
  } else {
    applyActiveState(annotations, clicked, true, onClick(clicked))
    return clicked
  }
}

