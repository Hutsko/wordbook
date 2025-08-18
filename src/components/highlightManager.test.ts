import { applyActiveState, toggleActiveHighlight, type AnnotationsApi, type Highlight } from './highlightManager'

describe('highlightManager', () => {
  const makeApis = () => {
    const annotations: AnnotationsApi = {
      remove: jest.fn(),
      highlight: jest.fn(),
    }
    return annotations
  }

  const h1: Highlight = { id: '1', cfiRange: 'cfi/1', text: 'One' }
  const h2: Highlight = { id: '2', cfiRange: 'cfi/2', text: 'Two' }

  it('applyActiveState applies correct class for active', () => {
    const api = makeApis()
    const onClick = jest.fn()

    applyActiveState(api, h1, true, onClick as any)

    expect(api.remove).toHaveBeenCalledWith('cfi/1', 'highlight')
    expect(api.highlight).toHaveBeenCalledWith('cfi/1', {}, onClick, 'hl-active')
  })

  it('applyActiveState applies correct class for inactive', () => {
    const api = makeApis()
    const onClick = jest.fn()

    applyActiveState(api, h1, false, onClick as any)

    expect(api.remove).toHaveBeenCalledWith('cfi/1', 'highlight')
    expect(api.highlight).toHaveBeenCalledWith('cfi/1', {}, onClick, 'hl')
  })

  it('toggleActiveHighlight activates clicked when none active', () => {
    const api = makeApis()
    const onClickFactory = (h: Highlight) => ((_: MouseEvent) => {})

    const result = toggleActiveHighlight(api, null, h1, onClickFactory as any)

    expect(result).toEqual(h1)
    expect(api.remove).toHaveBeenCalledWith('cfi/1', 'highlight')
    expect(api.highlight).toHaveBeenCalledWith('cfi/1', {}, expect.any(Function), 'hl-active')
  })

  it('toggleActiveHighlight deactivates current and activates new', () => {
    const api = makeApis()
    const onClickFactory = (h: Highlight) => ((_: MouseEvent) => {})

    const result = toggleActiveHighlight(api, h1, h2, onClickFactory as any)

    // deactivated h1
    expect(api.remove).toHaveBeenCalledWith('cfi/1', 'highlight')
    expect(api.highlight).toHaveBeenCalledWith('cfi/1', {}, expect.any(Function), 'hl')
    // activated h2
    expect(api.remove).toHaveBeenCalledWith('cfi/2', 'highlight')
    expect(api.highlight).toHaveBeenCalledWith('cfi/2', {}, expect.any(Function), 'hl-active')
    expect(result).toEqual(h2)
  })

  it('toggleActiveHighlight toggles off when clicking the same active', () => {
    const api = makeApis()
    const onClickFactory = (h: Highlight) => ((_: MouseEvent) => {})

    const result = toggleActiveHighlight(api, h1, h1, onClickFactory as any)

    expect(api.remove).toHaveBeenCalledWith('cfi/1', 'highlight')
    expect(api.highlight).toHaveBeenCalledWith('cfi/1', {}, expect.any(Function), 'hl')
    expect(result).toBeNull()
  })
})

