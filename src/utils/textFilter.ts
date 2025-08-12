// Default custom phrases to remove
export const DEFAULT_CUSTOM_PHRASES = [
  'Excerpt From',
  'This material may be protected by copyright.',
  'All rights reserved.',
  'Reprinted with permission.',
  'Source:',
  'From the book:',
  'Chapter',
  'Page',
]

/**
 * Filters out watermark text from user input
 * @param text - The text to filter
 * @param customPhrases - Array of custom phrases to remove
 * @returns The filtered text with watermarks removed
 */
export function filterWatermark(text: string, customPhrases: string[] = DEFAULT_CUSTOM_PHRASES): string {
  // Remove common watermark patterns
  const watermarkPatterns = [
    /\[.*?\]/g, // Remove text in square brackets
    /\(.*?\)/g, // Remove text in parentheses (but be careful with this one)
    /\b(watermark|draft|copy|sample|confidential|private|internal)\b/gi, // Remove common watermark words
    /\b\d{4}\s*©\s*\w+/gi, // Remove copyright notices like "2024 © Company"
    /\b[A-Z]{2,}\s*-\s*\d{4}\b/gi, // Remove document codes like "DOC-2024"
  ]
  
  let filteredText = text
  
  // Apply each pattern
  watermarkPatterns.forEach(pattern => {
    filteredText = filteredText.replace(pattern, '')
  })
  
  // Remove custom phrases (case-insensitive)
  customPhrases.forEach(phrase => {
    if (phrase.trim()) {
      const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex special characters
      const regex = new RegExp(escapedPhrase, 'gi')
      filteredText = filteredText.replace(regex, '')
    }
  })
  
  // Clean up extra whitespace
  filteredText = filteredText.replace(/\s+/g, ' ').trim()
  
  return filteredText
}

/**
 * Get a preview of what watermark filtering would do to text
 * @param text - The text to preview
 * @param customPhrases - Array of custom phrases to remove
 * @returns Object with original and filtered text
 */
export function getWatermarkPreview(text: string, customPhrases: string[] = DEFAULT_CUSTOM_PHRASES): { original: string; filtered: string; removed: string[] } {
  const original = text
  const filtered = filterWatermark(text, customPhrases)
  
  // Find what was removed (simplified approach)
  const removed: string[] = []
  const patterns = [
    { regex: /\[.*?\]/g, name: 'bracketed text' },
    { regex: /\(.*?\)/g, name: 'parenthetical text' },
    { regex: /\b(watermark|draft|copy|sample|confidential|private|internal)\b/gi, name: 'watermark words' },
    { regex: /\b\d{4}\s*©\s*\w+/gi, name: 'copyright notices' },
    { regex: /\b[A-Z]{2,}\s*-\s*\d{4}\b/gi, name: 'document codes' },
  ]
  
  patterns.forEach(({ regex, name }) => {
    const matches = text.match(regex)
    if (matches) {
      removed.push(...matches.map(match => `${match} (${name})`))
    }
  })
  
  // Check for custom phrases
  customPhrases.forEach(phrase => {
    if (phrase.trim()) {
      const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escapedPhrase, 'gi')
      const matches = text.match(regex)
      if (matches) {
        removed.push(...matches.map(match => `${match} (custom phrase)`))
      }
    }
  })
  
  return { original, filtered, removed }
}
