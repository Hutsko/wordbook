// Frequency scoring utilities

export function getFrequencyCategory(score: number): {
  category: string;
  description: string;
  color: string;
} {
  if (score >= 80) {
    return {
      category: 'Very Common',
      description: 'Appears frequently in everyday language',
      color: '#4caf50'
    };
  } else if (score >= 60) {
    return {
      category: 'Common',
      description: 'Regularly used in conversation and writing',
      color: '#8bc34a'
    };
  } else if (score >= 40) {
    return {
      category: 'Moderate',
      description: 'Used occasionally in specific contexts',
      color: '#ff9800'
    };
  } else if (score >= 20) {
    return {
      category: 'Uncommon',
      description: 'Rarely used, mostly in specialized contexts',
      color: '#f44336'
    };
  } else {
    return {
      category: 'Very Rare',
      description: 'Extremely rare, mostly in academic or technical contexts',
      color: '#9e9e9e'
    };
  }
}

// Frequency measurement suggestions
export const FREQUENCY_RESOURCES = {
  COCA: 'Corpus of Contemporary American English',
  BNC: 'British National Corpus',
  GoogleNgram: 'Google Books Ngram Viewer',
  SUBTLEX: 'SUBTLEX frequency norms',
  CEFR: 'Common European Framework of Reference'
};

// Example frequency scores for common words
export const EXAMPLE_FREQUENCIES = {
  'the': 100,
  'be': 95,
  'to': 90,
  'of': 85,
  'and': 80,
  'a': 75,
  'in': 70,
  'that': 65,
  'it': 60,
  'is': 55,
  'you': 50,
  'he': 45,
  'for': 40,
  'on': 35,
  'are': 30,
  'as': 25,
  'with': 20,
  'his': 15,
  'they': 10,
  'at': 5
};
