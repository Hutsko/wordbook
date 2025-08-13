import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

let client: GoogleGenerativeAI | null = null

function getClient(): GoogleGenerativeAI {
  if (!client) {
    if (!GEMINI_API_KEY) throw new Error('Missing VITE_GEMINI_API_KEY')
    client = new GoogleGenerativeAI(GEMINI_API_KEY)
  }
  return client
}

export type AutocompleteResult = {
  transcription?: string
  definition?: string
}

export async function autocompleteFromSentence(params: {
  term: string
  sentence: string
  language?: string
}): Promise<AutocompleteResult> {
  const { term, sentence, language = 'en' } = params
  const genAI = getClient()
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  const prompt = `You are an expert lexicographer specializing in contextual word definitions.

Given a sentence and a target term, analyze the term IN THE CONTEXT of the sentence and return JSON only with keys {"transcription","definition"}.

IMPORTANT RULES:
1. TRANSCRIPTION: Provide IPA in /slashes/ for the BASE FORM of the word (not the inflected form in the sentence)
   - For verbs: use infinitive form (e.g., "running" → /ˈrʌnɪŋ/ but base form is /rʌn/)
   - For nouns: use singular form (e.g., "books" → /bʊks/ but base form is /bʊk/)
   - For adjectives: use positive form (e.g., "happier" → /ˈhæpiər/ but base form is /ˈhæpi/)

2. DEFINITION: Create a contextually-aware definition that captures the meaning as used in the sentence:
   - Analyze how the word functions in the specific sentence context
   - Consider the surrounding words and overall meaning
   - Provide a definition that would help someone understand the word's meaning in this context
   - Keep it concise (max ~20 words) but contextually relevant
   - Use the base form of the word in your definition when possible

3. CONTEXT ANALYSIS:
   - Look at the sentence structure and word relationships
   - Consider the tone, register, and intended meaning
   - Provide a definition that fits the specific usage in this sentence

Language: ${language}
Term: "${term}" (as it appears in the sentence)
Sentence: "${sentence}"

Analyze the term's meaning and usage within this specific sentence context.`

  const generationConfig: GenerationConfig = {
    responseMimeType: 'application/json',
    temperature: 0.2,
  }

  const resp = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig })
  const text = resp.response.text().trim()
  try {
    const parsed = JSON.parse(text)
    return {
      transcription: typeof parsed.transcription === 'string' ? parsed.transcription : undefined,
      definition: typeof parsed.definition === 'string' ? parsed.definition : undefined,
    }
  } catch {
    // Fallback: attempt to parse heuristically
    const result: AutocompleteResult = {}
    const transMatch = text.match(/transcription\s*[:=]\s*([/\[][^\n\r]+?[/\]])/i)
    if (transMatch) result.transcription = transMatch[1]
    const defMatch = text.match(/definition\s*[:=]\s*([^\n\r]+)/i)
    if (defMatch) result.definition = defMatch[1].trim()
    return result
  }
}

export async function generateSentencesForWord(params: {
  term: string
  existingSentence?: string
  count?: number
}): Promise<string[]> {
  const { term, existingSentence, count = 5 } = params
  const genAI = getClient()
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  
  const prompt = `You are a language learning assistant. Generate ${count} natural, diverse sentences using the word "${term}".

Requirements:
- Each sentence should be natural and contextually appropriate
- Vary the sentence structure, tense, and context
- Make sentences suitable for language learning
- Keep sentences reasonably short (10-20 words each)
- Use the word in different grammatical forms if applicable
- Ensure sentences are clear and understandable

${existingSentence ? `Note: The user already has this sentence: "${existingSentence}" - make sure your new sentences are different and complementary.` : ''}

Return only the sentences, one per line, without numbering or additional text.`

  const generationConfig: GenerationConfig = {
    temperature: 0.7,
  }

  const resp = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig })
  const text = resp.response.text().trim()
  
  // Split by lines and clean up
  const sentences = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .slice(0, count) // Ensure we don't exceed the requested count
  
  return sentences
}

export async function defineWordWithoutContext(params: {
  term: string
  language?: string
}): Promise<AutocompleteResult> {
  const { term, language = 'en' } = params
  const genAI = getClient()
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  const prompt = `You are an expert lexicographer. Provide a definition for the word "${term}" without any specific context.

Return JSON only with keys {"transcription","definition"}.

IMPORTANT RULES:
1. TRANSCRIPTION: Provide IPA in /slashes/ for the BASE FORM of the word
   - For verbs: use infinitive form (e.g., "running" → /ˈrʌnɪŋ/ but base form is /rʌn/)
   - For nouns: use singular form (e.g., "books" → /bʊks/ but base form is /bʊk/)
   - For adjectives: use positive form (e.g., "happier" → /ˈhæpiər/ but base form is /ˈhæpi/)

2. DEFINITION: Create a general definition that captures the word's meaning:
   - Provide the most common meaning(s) of the word
   - Keep it concise (max ~20 words) but comprehensive
   - Use the base form of the word in your definition when possible
   - Focus on the core meaning rather than contextual usage

Language: ${language}
Term: "${term}"

Provide a general definition for this word.`

  const generationConfig: GenerationConfig = {
    responseMimeType: 'application/json',
    temperature: 0.2,
  }

  const resp = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig })
  const text = resp.response.text().trim()
  try {
    const parsed = JSON.parse(text)
    return {
      transcription: typeof parsed.transcription === 'string' ? parsed.transcription : undefined,
      definition: typeof parsed.definition === 'string' ? parsed.definition : undefined,
    }
  } catch {
    // Fallback: attempt to parse heuristically
    const result: AutocompleteResult = {}
    const transMatch = text.match(/transcription\s*[:=]\s*([/\[][^\n\r]+?[/\]])/i)
    if (transMatch) result.transcription = transMatch[1]
    const defMatch = text.match(/definition\s*[:=]\s*([^\n\r]+)/i)
    if (defMatch) result.definition = defMatch[1].trim()
    return result
  }
}


