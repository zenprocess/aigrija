# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in ai-grija.ro, please report it responsibly.

**Email**: security@ai-grija.ro

**Do NOT**:
- Open a public GitHub issue for security vulnerabilities
- Post vulnerability details on social media or forums
- Exploit the vulnerability beyond what is necessary to demonstrate it

**Do**:
- Provide a clear description of the vulnerability
- Include steps to reproduce if possible
- Allow reasonable time for a fix before public disclosure

## Response Timeline

| Action | Timeline |
|--------|----------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 5 business days |
| Fix deployed | Within 30 days (critical: 7 days) |

## Scope

In scope:
- ai-grija.ro web application
- API endpoints (api.ai-grija.ro)
- Admin panel (admin.ai-grija.ro)
- Telegram and WhatsApp bot integrations

Out of scope:
- Third-party services (Buttondown, Umami, Cloudflare)
- Social engineering attacks
- Denial of service attacks

## Recognition

We credit security researchers who report valid vulnerabilities (unless they prefer anonymity).

## Security Measures

This project employs defense-in-depth security:
- Pre-commit secret scanning (ggshield)
- Pre-push scanning (Gitleaks + TruffleHog + ggshield)
- CI/CD secret scanning gates
- GitHub secret scanning + push protection
- Cloudflare Zero Trust for admin access
- GDPR-compliant data handling
