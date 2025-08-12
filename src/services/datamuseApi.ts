// Datamuse API service for word frequency data
// Based on: https://www.datamuse.com/api/

interface DatamuseWord {
  word: string;
  score: number;
  tags?: string[];
  defs?: string[];
  numSyllables?: number;
}

interface DatamuseFrequencyData {
  frequency: number; // 0-100 scale
  rawFrequency?: number; // Raw frequency per million words
  category: string;
  description: string;
}

const DATAMUSE_BASE_URL = 'https://api.datamuse.com';

/**
 * Get word frequency data from Datamuse API
 * @param word - The word to look up
 * @returns Promise with frequency data
 */
export async function getWordFrequency(word: string): Promise<DatamuseFrequencyData> {
  try {
    // Use the API to get word metadata including frequency
    const response = await fetch(
      `${DATAMUSE_BASE_URL}/words?sp=${encodeURIComponent(word)}&md=f&max=1`
    );
    
    if (!response.ok) {
      throw new Error(`Datamuse API error: ${response.status}`);
    }
    
    const data: DatamuseWord[] = await response.json();
    
    if (data.length === 0) {
      // Word not found, return default frequency
      return {
        frequency: 50,
        category: 'Unknown',
        description: 'Word frequency not available'
      };
    }
    
    const wordData = data[0];
    const frequencyTag = wordData.tags?.find(tag => tag.startsWith('f:'));
    
    if (!frequencyTag) {
      // No frequency data available
      return {
        frequency: 50,
        category: 'Unknown',
        description: 'Word frequency not available'
      };
    }
    
    // Extract raw frequency (per million words)
    const rawFrequency = parseFloat(frequencyTag.substring(2));
    
    // Convert to 0-100 scale using logarithmic scaling
    // This provides better distribution across the scale
    const frequency = convertRawFrequencyToScale(rawFrequency);
    
    return {
      frequency,
      rawFrequency,
      category: getFrequencyCategory(frequency).category,
      description: getFrequencyCategory(frequency).description
    };
  } catch (error) {
    console.error('Error fetching word frequency:', error);
    // Return default frequency on error
    return {
      frequency: 50,
      category: 'Error',
      description: 'Failed to fetch frequency data'
    };
  }
}

/**
 * Convert raw frequency (per million words) to 0-100 scale
 * Uses logarithmic scaling for better distribution
 */
function convertRawFrequencyToScale(rawFrequency: number): number {
  if (rawFrequency <= 0) return 0;
  
  // Use logarithmic scaling to distribute frequencies better
  // Most common words: 1000+ per million -> 90-100
  // Common words: 100-1000 per million -> 70-90
  // Moderate words: 10-100 per million -> 40-70
  // Uncommon words: 1-10 per million -> 20-40
  // Rare words: <1 per million -> 0-20
  
  const logFreq = Math.log10(rawFrequency + 1);
  const scaled = Math.min(100, Math.max(0, (logFreq / 4) * 100));
  
  return Math.round(scaled);
}

/**
 * Get frequency category based on 0-100 scale
 */
function getFrequencyCategory(frequency: number): { category: string; description: string } {
  if (frequency >= 80) {
    return {
      category: 'Very Common',
      description: 'Appears frequently in everyday language'
    };
  } else if (frequency >= 60) {
    return {
      category: 'Common',
      description: 'Regularly used in conversation and writing'
    };
  } else if (frequency >= 40) {
    return {
      category: 'Moderate',
      description: 'Used occasionally in specific contexts'
    };
  } else if (frequency >= 20) {
    return {
      category: 'Uncommon',
      description: 'Rarely used, mostly in specialized contexts'
    };
  } else {
    return {
      category: 'Very Rare',
      description: 'Extremely rare, mostly in academic or technical contexts'
    };
  }
}

/**
 * Get multiple word frequencies in batch
 * Note: Datamuse API doesn't support batch requests, so this makes individual calls
 */
export async function getMultipleWordFrequencies(words: string[]): Promise<Map<string, DatamuseFrequencyData>> {
  const results = new Map<string, DatamuseFrequencyData>();
  
  // Process words sequentially to avoid rate limiting
  for (const word of words) {
    try {
      const frequencyData = await getWordFrequency(word);
      results.set(word.toLowerCase(), frequencyData);
      
      // Add small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error fetching frequency for "${word}":`, error);
      results.set(word.toLowerCase(), {
        frequency: 50,
        category: 'Error',
        description: 'Failed to fetch frequency data'
      });
    }
  }
  
  return results;
}

/**
 * Get word suggestions with frequency data
 * Useful for autocomplete features
 */
export async function getWordSuggestions(prefix: string, maxResults: number = 10): Promise<DatamuseWord[]> {
  try {
    const response = await fetch(
      `${DATAMUSE_BASE_URL}/words?sp=${encodeURIComponent(prefix)}*&md=f&max=${maxResults}`
    );
    
    if (!response.ok) {
      throw new Error(`Datamuse API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching word suggestions:', error);
    return [];
  }
}
