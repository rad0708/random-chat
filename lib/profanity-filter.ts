const PROFANITY_LIST = [
  // Korean profanity
  "씨발",
  "개새끼",
  "병신",
  "좆",
  "지랄",
  "엿먹어",
  "닥쳐",
  "ㅅㅂ",
  "ㄱㅅㄲ",
  "ㅂㅅ",
  "시발",
  "개새",
  "새끼",
  "년",
  "놈",
  // English profanity
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "damn",
  "crap",
  "bastard",
  "dick",
  "pussy",
  "cock",
]

export function containsProfanity(text: string): boolean {
  const lowerText = text.toLowerCase()
  const normalizedText = lowerText.replace(/[\s\-_.]/g, "")
  return PROFANITY_LIST.some((word) => normalizedText.includes(word.toLowerCase()))
}

export function filterProfanity(text: string): string {
  let filtered = text
  PROFANITY_LIST.forEach((word) => {
    const regex = new RegExp(word, "gi")
    filtered = filtered.replace(regex, "*".repeat(word.length))
  })
  return filtered
}

export function isSpam(text: string): boolean {
  // Check for repeated characters (e.g., "aaaaaaa")
  if (/(.)\1{4,}/.test(text)) return true

  // Check for excessive caps (more than 70% uppercase)
  const capsCount = (text.match(/[A-Z]/g) || []).length
  if (text.length > 10 && capsCount / text.length > 0.7) return true

  // Check for excessive special characters (more than 30%)
  const specialCount = (text.match(/[!@#$%^&*()]/g) || []).length
  if (specialCount > text.length * 0.3) return true

  const words = text.split(/\s+/)
  const wordCounts = new Map<string, number>()
  for (const word of words) {
    if (word.length > 2) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
      if (wordCounts.get(word)! > 3) return true
    }
  }

  const emojiCount = (
    text.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []
  ).length
  if (emojiCount > 5) return true

  return false
}
