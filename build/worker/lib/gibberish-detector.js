/**
 * Gibberish detection using simple heuristics — no AI required.
 * Used to reject nonsense input before calling Workers AI.
 */
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'ă', 'â', 'î', 'ș', 'ț']);
/** Shannon entropy of a string (bits per character). */
function shannonEntropy(text) {
    const freq = {};
    for (const ch of text) {
        freq[ch] = (freq[ch] ?? 0) + 1;
    }
    const len = text.length;
    let entropy = 0;
    for (const count of Object.values(freq)) {
        const p = count / len;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}
/**
 * Returns `{ gibberish: true, reason }` if the text looks like random/garbage input.
 * Short texts (< 10 chars) are always passed through without checking.
 */
export function isGibberish(text) {
    const trimmed = text.trim();
    // Skip check for very short inputs
    if (trimmed.length < 10) {
        return { gibberish: false };
    }
    // 1. Shannon entropy > 5.5 → likely random character soup
    const entropy = shannonEntropy(trimmed);
    if (entropy > 5.5) {
        return { gibberish: true, reason: `Entropie prea mare (${entropy.toFixed(2)})` };
    }
    // 2. Vowel ratio check — Romanian/English text has 30–50% vowels
    const letters = trimmed.toLowerCase().replace(/\s/g, '');
    if (letters.length > 0) {
        let vowelCount = 0;
        for (const ch of letters) {
            if (VOWELS.has(ch))
                vowelCount++;
        }
        const ratio = vowelCount / letters.length;
        if (ratio < 0.10) {
            return { gibberish: true, reason: `Ratio vocale prea mic (${(ratio * 100).toFixed(1)}%)` };
        }
        if (ratio > 0.70) {
            return { gibberish: true, reason: `Ratio vocale prea mare (${(ratio * 100).toFixed(1)}%)` };
        }
    }
    // 3. Repeated character > 40% of the full trimmed text
    const freq = {};
    for (const ch of trimmed) {
        freq[ch] = (freq[ch] ?? 0) + 1;
    }
    for (const [ch, count] of Object.entries(freq)) {
        if (ch === ' ')
            continue; // spaces naturally repeat a lot
        if (count / trimmed.length > 0.40) {
            return { gibberish: true, reason: `Caracter '${ch}' reperat de ${count} ori` };
        }
    }
    // 4. Average word length > 15 characters → suspicious
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
        const avgLen = words.reduce((sum, w) => sum + w.length, 0) / words.length;
        if (avgLen > 15) {
            return { gibberish: true, reason: `Lungime medie cuvinte prea mare (${avgLen.toFixed(1)})` };
        }
    }
    return { gibberish: false };
}
