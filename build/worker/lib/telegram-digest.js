import { structuredLog } from './logger';
// ── Helpers ──────────────────────────────────────────────────────────────────
function severityEmoji(severity) {
    if (severity === 'critical')
        return '🔴';
    if (severity === 'high')
        return '🟠';
    if (severity === 'medium')
        return '🟡';
    return '🟢';
}
function truncate(text, max) {
    if (text.length <= max)
        return text;
    return text.slice(0, max - 3) + '...';
}
export function buildDigestMessage(digest, baseUrl) {
    const lines = [
        '🛡️ <b>Digest Săptămânal AI Grija</b>',
        `<i>Săptămâna ${digest.weekOf}</i>`,
        '',
        '📊 <b>Statistici săptămână:</b>',
        `• ${digest.stats.totalChecks} verificări efectuate`,
        `• ${digest.stats.totalAlerts} alerte trimise`,
        `• ${digest.stats.quizCompletions} quiz-uri completate`,
        `• ${digest.stats.communityReports} raportări comunitate`,
        '',
    ];
    if (digest.topScams.length > 0) {
        lines.push('🚨 <b>Top escrocherii ale săptămânii:</b>');
        const top3 = digest.topScams.slice(0, 3);
        for (const scam of top3) {
            const emoji = severityEmoji(scam.severity);
            const title = truncate(scam.title, 60);
            lines.push(`${emoji} <a href="${scam.url}">${title}</a> (${scam.reportCount} raportări)`);
        }
        lines.push('');
    }
    if (digest.blogPosts.length > 0) {
        const post = digest.blogPosts[0];
        const postUrl = `${baseUrl}/blog/${post.slug}`;
        lines.push('📰 <b>Articol nou:</b>');
        lines.push(`<a href="${postUrl}">${truncate(post.title, 80)}</a>`);
        lines.push('');
    }
    if (digest.tips.length > 0) {
        lines.push('💡 <b>Sfatul săptămânii:</b>');
        lines.push(truncate(digest.tips[0], 200));
        lines.push('');
    }
    lines.push(`🔗 <a href="${baseUrl}">ai-grija.ro</a> — Verifică orice mesaj suspect gratuit`);
    const message = lines.join('\n');
    return message.length > 4090 ? message.slice(0, 4087) + '...' : message;
}
export async function sendDigestToTelegram(env, digest) {
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_ADMIN_CHAT_ID;
    if (!token || !chatId) {
        structuredLog('warn', 'telegram_digest_missing_config', {
            stage: 'digest',
            hasToken: !!token,
            hasChatId: !!chatId,
        });
        return;
    }
    const baseUrl = env.BASE_URL ?? 'https://ai-grija.ro';
    const message = buildDigestMessage(digest, baseUrl);
    const body = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
    };
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
            const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            if (!resp.ok) {
                const errText = await resp.text().catch(() => '');
                structuredLog('error', 'telegram_digest_send_failed', {
                    stage: 'digest',
                    status: resp.status,
                    error: errText,
                });
            }
            else {
                structuredLog('info', 'telegram_digest_sent', {
                    stage: 'digest',
                    weekOf: digest.weekOf,
                });
            }
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    catch (err) {
        structuredLog('error', 'telegram_digest_exception', {
            stage: 'digest',
            error: String(err),
            stack: err instanceof Error ? err.stack : undefined,
        });
    }
}
