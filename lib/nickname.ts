const adjectives = ['활발한','용감한','명랑한','반짝이는','즐거운','차분한','똑똑한','귀여운','신비한','빛나는','따뜻한','싱그러운'];
const nouns = ['다람쥐','고래','여우','부엉이','고양이','호랑이','사자','판다','토끼','너구리','수달','올빼미'];

export function generateNickname(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 900 + 100);
  return `${adjective} ${noun}${number}`;
}
