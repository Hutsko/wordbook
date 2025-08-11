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
  const prompt = `You are a lexicographer.
Given a sentence and a target term, return JSON only with keys {"transcription","definition"}.
- transcription: IPA in /slashes/ for the exact term
- definition: conventional dictionary style. Requirements:
  * single concise sentence (max ~18 words)
  * neutral tone; no examples or extra explanations
  * context-aware but phrased generally (do not mention the sentence or context explicitly)
  * for nouns: start with "a" or "an" + noun phrase
  * for verbs: start with "to" + base verb
  * for adjectives/adverbs: describe the quality/state succinctly
  * avoid starting with "the", "means", or "in the context"
Language: ${language}
Term: ${term}
Sentence: ${sentence}`

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


