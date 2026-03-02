/**
 * Backend i18n helper for API response messages.
 * Supports: ro (default), bg, hu, uk
 */
const SUPPORTED_LANGS = ['ro', 'bg', 'hu', 'uk', 'en'];
export function normalizeLang(lang) {
    if (lang && SUPPORTED_LANGS.includes(lang)) {
        return lang;
    }
    return 'ro';
}
const MESSAGES = {
    ro: {
        'error.rate_limit': 'Prea multe cereri. Încearcă din nou în {{seconds}} secunde.',
        'error.validation': 'Date invalide. Verificați câmpurile completate.',
        'error.generic': 'A apărut o eroare. Vă rugăm să încercați din nou.',
        'error.image_too_large': 'Imaginea depășește limita de 5MB.',
        'error.unsupported_format': 'Format de imagine neacceptat. Folosiți PNG, JPG sau WEBP.',
        'error.content_required': 'Textul mesajului sau o imagine este obligatorie.',
        'success.check_complete': 'Verificare finalizată.',
        'success.report_submitted': 'Raport trimis cu succes.',
    },
    bg: {
        'error.rate_limit': 'Твърде много заявки. Опитайте отново след {{seconds}} секунди.',
        'error.validation': 'Невалидни данни. Проверете попълнените полета.',
        'error.generic': 'Възникна грешка. Моля, опитайте отново.',
        'error.image_too_large': 'Изображението надвишава лимита от 5MB.',
        'error.unsupported_format': 'Неподдържан формат на изображението. Използвайте PNG, JPG или WEBP.',
        'error.content_required': 'Текстът на съобщението или изображение е задължително.',
        'success.check_complete': 'Проверката е завършена.',
        'success.report_submitted': 'Докладът е изпратен успешно.',
    },
    hu: {
        'error.rate_limit': 'Túl sok kérés. Próbálja újra {{seconds}} másodperc múlva.',
        'error.validation': 'Érvénytelen adatok. Ellenőrizze a kitöltött mezőket.',
        'error.generic': 'Hiba történt. Kérjük, próbálja újra.',
        'error.image_too_large': 'A kép mérete meghaladja az 5MB-os korlátot.',
        'error.unsupported_format': 'Nem támogatott képformátum. Használjon PNG, JPG vagy WEBP formátumot.',
        'error.content_required': 'Az üzenet szövege vagy egy kép kötelező.',
        'success.check_complete': 'Ellenőrzés befejezve.',
        'success.report_submitted': 'A jelentés sikeresen elküldve.',
    },
    uk: {
        'error.rate_limit': 'Забагато запитів. Спробуйте знову через {{seconds}} секунд.',
        'error.validation': 'Недійсні дані. Перевірте заповнені поля.',
        'error.generic': 'Виникла помилка. Будь ласка, спробуйте ще раз.',
        'error.image_too_large': 'Зображення перевищує ліміт у 5MB.',
        'error.unsupported_format': 'Непідтримуваний формат зображення. Використовуйте PNG, JPG або WEBP.',
        'error.content_required': 'Текст повідомлення або зображення є обов\'язковим.',
        'success.check_complete': 'Перевірку завершено.',
        'success.report_submitted': 'Звіт успішно надіслано.',
    },
    en: {
        'error.rate_limit': 'Too many requests. Try again in {{seconds}} seconds.',
        'error.validation': 'Invalid data. Please check the completed fields.',
        'error.generic': 'An error occurred. Please try again.',
        'error.image_too_large': 'Image exceeds the 5MB limit.',
        'error.unsupported_format': 'Unsupported image format. Use PNG, JPG or WEBP.',
        'error.content_required': 'Message text or an image is required.',
        'success.check_complete': 'Check complete.',
        'success.report_submitted': 'Report submitted successfully.',
    },
};
/**
 * Get a localized API message.
 * @param key - message key
 * @param lang - language code (defaults to 'ro')
 * @param vars - optional interpolation variables
 */
export function getApiMessage(key, lang, vars) {
    const normalizedLang = normalizeLang(lang);
    const messages = MESSAGES[normalizedLang] ?? MESSAGES.ro;
    let message = messages[key] ?? MESSAGES.ro[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            message = message.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
    }
    return message;
}
