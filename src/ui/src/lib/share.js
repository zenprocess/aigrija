/**
 * Enhanced share link builder for ai-grija.ro results.
 *
 * Supports: WhatsApp, Viber, Messenger, Facebook, Telegram
 * Languages: ro, bg, hu, uk
 */

export function getShareLinks(verdict, url, lang = 'ro') {
  const messages = {
    ro: `⚠️ Am verificat un mesaj suspect pe ai-grija.ro — e ${verdict}!`,
    bg: `⚠️ Проверих подозрително съобщение в ai-grija.ro — то е ${verdict}!`,
    hu: `⚠️ Ellenőriztem egy gyanús üzenetet az ai-grija.ro oldalon — ${verdict}!`,
    uk: `⚠️ Я перевірив підозріле повідомлення на ai-grija.ro — це ${verdict}!`,
  };
  const text = encodeURIComponent(messages[lang] || messages.ro);
  const shareUrl = encodeURIComponent(url || 'https://ai-grija.ro');

  return {
    whatsapp: `https://wa.me/?text=${text}%20${shareUrl}`,
    viber: `viber://forward?text=${decodeURIComponent(text)} ${decodeURIComponent(shareUrl)}`,
    messenger: `https://www.facebook.com/dialog/send?link=${shareUrl}&app_id=0&redirect_uri=${shareUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${text}`,
    telegram: `https://t.me/share/url?url=${shareUrl}&text=${text}`,
  };
}
