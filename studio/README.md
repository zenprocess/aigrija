# ai-grija.ro Content Studio

Sanity Studio for managing blog posts, threat reports, bank guides, and educational content.

## Setup
1. Create a Sanity project at sanity.io/manage
2. Copy .env.example to .env, fill in project ID
3. npm install
4. npm run dev

## Deploy (behind CF Zero Trust)
npm run build -> deploy dist/ to CF Pages

## Content Types
- BlogPost -- articles, awareness content
- ThreatReport -- phishing campaign reports
- BankGuide -- bank-specific security guides
- WeeklyDigest -- weekly threat summary
- SchoolModule -- educational content
- CommunityStory -- user-submitted stories
- PressRelease -- media content
