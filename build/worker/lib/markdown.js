/**
 * Simple Markdown to HTML converter for admin draft preview.
 * No external deps — regex-based, sufficient for AI-generated content.
 */
export function markdownToHtml(md) {
    const lines = md.split('\n');
    const out = [];
    let inCodeBlock = false;
    let inList = false;
    let inOrderedList = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('```')) {
            if (!inCodeBlock) {
                if (inList) {
                    out.push('</ul>');
                    inList = false;
                }
                if (inOrderedList) {
                    out.push('</ol>');
                    inOrderedList = false;
                }
                inCodeBlock = true;
                out.push('<pre><code>');
            }
            else {
                inCodeBlock = false;
                out.push('</code></pre>');
            }
            continue;
        }
        if (inCodeBlock) {
            out.push(escapeHtml(line));
            continue;
        }
        const hMatch = line.match(/^(#{1,6})\s+(.*)/);
        if (hMatch) {
            if (inList) {
                out.push('</ul>');
                inList = false;
            }
            if (inOrderedList) {
                out.push('</ol>');
                inOrderedList = false;
            }
            const level = hMatch[1].length;
            out.push(`<h${level}>${inlineFormat(hMatch[2])}</h${level}>`);
            continue;
        }
        const olItem = line.match(/^\d+\.\s+(.*)/);
        if (olItem) {
            if (inList) {
                out.push('</ul>');
                inList = false;
            }
            if (!inOrderedList) {
                out.push('<ol>');
                inOrderedList = true;
            }
            out.push(`<li>${inlineFormat(olItem[1])}</li>`);
            continue;
        }
        const ulItem = line.match(/^[-*]\s+(.*)/);
        if (ulItem) {
            if (inOrderedList) {
                out.push('</ol>');
                inOrderedList = false;
            }
            if (!inList) {
                out.push('<ul>');
                inList = true;
            }
            out.push(`<li>${inlineFormat(ulItem[1])}</li>`);
            continue;
        }
        if (inList) {
            out.push('</ul>');
            inList = false;
        }
        if (inOrderedList) {
            out.push('</ol>');
            inOrderedList = false;
        }
        if (line.trim() === '') {
            out.push('');
            continue;
        }
        out.push(`<p>${inlineFormat(line)}</p>`);
    }
    if (inList)
        out.push('</ul>');
    if (inOrderedList)
        out.push('</ol>');
    if (inCodeBlock)
        out.push('</code></pre>');
    return out.join('\n');
}
function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function inlineFormat(s) {
    s = s.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*(.*?)\*/g, '<em>$1</em>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
}
