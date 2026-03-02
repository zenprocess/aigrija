import { CAMPAIGNS } from '../data/campaigns';
export function matchCampaigns(text, url) {
    const lower = text.toLowerCase();
    const urlLower = url?.toLowerCase() || '';
    const matches = [];
    for (const campaign of CAMPAIGNS) {
        const matched = [];
        let score = 0;
        for (const pattern of campaign.patterns) {
            if (lower.includes(pattern.toLowerCase())) {
                matched.push(pattern);
                score += 1;
            }
        }
        if (url) {
            for (const pattern of campaign.url_patterns) {
                if (urlLower.includes(pattern.toLowerCase())) {
                    matched.push(`[url] ${pattern}`);
                    score += 2;
                }
            }
        }
        if (score > 0) {
            matches.push({ campaign, score, matched_patterns: matched });
        }
    }
    return matches.sort((a, b) => b.score - a.score);
}
