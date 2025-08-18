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
  let filteredText = text
  
  // Remove custom phrases (case-insensitive)
  customPhrases.forEach(phrase => {
    if (phrase.trim()) {
      const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex special characters
      const regex = new RegExp(escapedPhrase, 'gim') // Add multiline flag
      filteredText = filteredText.replace(regex, '')
    }
  })
  
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
  
  // Find what was removed (only custom phrases)
  const removed: string[] = []
  
  // Check for custom phrases
  customPhrases.forEach(phrase => {
    if (phrase.trim()) {
      const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escapedPhrase, 'gim') // Add multiline flag
      const matches = text.match(regex)
      if (matches) {
        removed.push(...matches.map(match => `${match} (custom phrase)`))
      }
    }
  })
  
  return { original, filtered, removed }
}
