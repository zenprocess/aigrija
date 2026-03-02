const PLURAL_RULES = {
    ro: (n) => n === 1
        ? 'one'
        : n === 0 || (n % 100 > 0 && n % 100 < 20)
            ? 'few'
            : 'other',
    bg: (n) => (n === 1 ? 'one' : 'other'),
    hu: (n) => (n === 1 ? 'one' : 'other'),
    uk: (n) => n === 1
        ? 'one'
        : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)
            ? 'few'
            : 'other',
};
export function pluralize(count, forms, lang = 'ro') {
    const rule = PLURAL_RULES[lang] || PLURAL_RULES['ro'];
    return forms[rule(count)].replace('{n}', String(count));
}
const LOCALE_MAP = {
    ro: 'ro-RO',
    bg: 'bg-BG',
    hu: 'hu-HU',
    uk: 'uk-UA',
};
export function formatDate(date, lang) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(LOCALE_MAP[lang] || 'ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(d);
}
export function formatNumber(num, lang) {
    return new Intl.NumberFormat(LOCALE_MAP[lang] || 'ro-RO').format(num);
}
