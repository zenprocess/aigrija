/**
 * Text-to-Speech helpers using the Web Speech API.
 *
 * Language map:
 *   ro → 'ro-RO'
 *   bg → 'bg-BG'
 *   hu → 'hu-HU'
 *   uk → 'uk-UA'
 */

export function speakText(text, lang = 'ro-RO') {
  if (!('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel(); // stop any current speech
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9; // slightly slower for clarity
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}
