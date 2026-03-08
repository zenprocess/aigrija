/**
 * Seed blog content via Sanity mutations API.
 *
 * Usage:
 *   SANITY_PROJECT_ID=xxx SANITY_DATASET=production SANITY_WRITE_TOKEN=yyy npx tsx scripts/seed-content.ts
 *
 * Or with .dev.vars:
 *   npx tsx scripts/seed-content.ts
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SANITY_API_VERSION = 'v2024-01-01';

// ---------------------------------------------------------------------------
// Env loading
// ---------------------------------------------------------------------------

function loadDevVars(): void {
  const devVarsPath = resolve(process.cwd(), '.dev.vars');
  if (!existsSync(devVarsPath)) return;
  const lines = readFileSync(devVarsPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDevVars();

const PROJECT_ID = process.env.SANITY_PROJECT_ID;
const DATASET = process.env.SANITY_DATASET || 'production';
const TOKEN = process.env.SANITY_WRITE_TOKEN;

if (!PROJECT_ID || !TOKEN) {
  console.error('Missing SANITY_PROJECT_ID or SANITY_WRITE_TOKEN. Set them as env vars or in .dev.vars');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Document definitions
// ---------------------------------------------------------------------------

const authorDoc = {
  _type: 'author' as const,
  _id: 'author-aigrija-team',
  name: 'Echipa AI Grija',
  bio: 'Echipa de securitate cibernetică AI Grija protejează utilizatorii români împotriva amenințărilor online.',
};

const categoryDocs = [
  {
    _type: 'category' as const,
    _id: 'category-ghiduri',
    title: 'Ghiduri de Protecție',
    slug: { _type: 'slug' as const, current: 'ghiduri' },
  },
  {
    _type: 'category' as const,
    _id: 'category-educatie',
    title: 'Educație Digitală',
    slug: { _type: 'slug' as const, current: 'educatie' },
  },
  {
    _type: 'category' as const,
    _id: 'category-amenintari',
    title: 'Amenințări Recente',
    slug: { _type: 'slug' as const, current: 'amenintari' },
  },
];

const blogPostDocs = [
  // --- category: ghid ---
  {
    _type: 'blogPost' as const,
    _id: 'blogpost-protejare-cont-bancar',
    title: 'Cum să vă protejați contul bancar online',
    slug: { _type: 'slug' as const, current: 'cum-sa-va-protejati-contul-bancar-online' },
    excerpt:
      'Aflați cele mai importante măsuri de securitate pentru a vă proteja contul bancar împotriva atacurilor cibernetice. Ghid practic cu sfaturi testate de experți.',
    body: `Securitatea contului bancar online este una dintre cele mai importante preocupări ale utilizatorilor de internet din România. Cu peste 8 milioane de utilizatori de internet banking, numărul tentativelor de fraudă crește de la an la an, iar atacatorii devin din ce în ce mai sofisticați.

Primul pas esențial este activarea autentificării în doi pași (2FA) pentru contul dumneavoastră bancar. Majoritatea băncilor din România — BRD, BCR, ING, Raiffeisen — oferă această funcționalitate fie prin SMS, fie prin aplicații dedicate precum Token digital. Nu ignorați niciodată această opțiune, deoarece ea adaugă un strat suplimentar de protecție chiar și în cazul în care parola vă este compromisă.

Verificați întotdeauna adresa URL a site-ului băncii înainte de a introduce datele de autentificare. Adresa trebuie să înceapă cu https:// și să conțină domeniul oficial al băncii. Atacatorii creează frecvent pagini false care imită perfect interfața băncii, dar au adrese ușor diferite — de exemplu, ing-romania.com în loc de ing.ro.

Nu accesați niciodată contul bancar de pe rețele Wi-Fi publice, din cafenele, aeroporturi sau hoteluri. Aceste rețele sunt adesea monitorizate de atacatori care pot intercepta datele transmise. Dacă trebuie neapărat să accesați contul în deplasare, folosiți conexiunea de date mobile sau un VPN de încredere.

Configurați notificările prin SMS sau push pentru fiecare tranzacție efectuată din contul dumneavoastră. Astfel, veți fi alertat imediat în cazul unei tranzacții neautorizate și veți putea contacta banca pentru a bloca contul. Timpul de reacție este crucial — cu cât raportați mai repede, cu atât sunt mai mari șansele de recuperare a fondurilor.`,
    category: 'ghid',
    language: 'ro',
    publishedAt: '2026-03-05T10:00:00Z',
    author: { _type: 'reference' as const, _ref: 'author-aigrija-team' },
    categories: [{ _type: 'reference' as const, _ref: 'category-ghiduri' }],
  },
  {
    _type: 'blogPost' as const,
    _id: 'blogpost-parole-sigure-2fa',
    title: 'Ghid complet: Parole sigure și autentificare în doi pași',
    slug: { _type: 'slug' as const, current: 'ghid-complet-parole-sigure-si-autentificare-in-doi-pasi' },
    excerpt:
      'Învățați cum să creați parole puternice și să activați autentificarea în doi pași pentru toate conturile importante. Un ghid esențial pentru securitatea digitală.',
    body: `Parolele slabe rămân principala cauză a compromiterii conturilor online în România. Conform raportului CERT-RO din 2025, peste 60% din incidentele de securitate raportate au implicat parole ușor de ghicit sau reutilizate pe mai multe platforme.

O parolă sigură trebuie să aibă cel puțin 12 caractere și să combine litere mari, litere mici, cifre și caractere speciale. Evitați informațiile personale precum numele, data nașterii sau numele animalului de companie — atacatorii verifică întotdeauna aceste variante primele. Cel mai bun sfat: folosiți o frază de trecere (passphrase) precum „CafeauaDimineața#2026!" — lungă, memorabilă și greu de spart.

Utilizați un manager de parole precum Bitwarden, 1Password sau KeePass. Aceste aplicații generează și stochează parole unice pentru fiecare cont, iar dumneavoastră trebuie să rețineți doar o singură parolă principală. Managerii de parole vă protejează și împotriva phishing-ului, deoarece nu vor completa automat datele pe un site fals.

Autentificarea în doi pași (2FA) este al doilea strat de protecție. Preferați aplicațiile de autentificare precum Google Authenticator, Microsoft Authenticator sau Authy în locul SMS-urilor, deoarece mesajele text pot fi interceptate prin atacuri de tip SIM swapping. Dacă un serviciu oferă chei fizice de securitate (FIDO2/WebAuthn), acestea sunt cea mai sigură opțiune disponibilă.

Nu partajați niciodată codurile 2FA cu nimeni, nici măcar cu persoane care pretind că sunt de la suportul tehnic. Nicio companie legitimă nu vă va cere vreodată codul de autentificare. Dacă primiți un cod pe care nu l-ați solicitat, schimbați imediat parola contului respectiv — cineva ar putea încerca să vă acceseze contul.`,
    category: 'ghid',
    language: 'ro',
    publishedAt: '2026-03-03T09:00:00Z',
    author: { _type: 'reference' as const, _ref: 'author-aigrija-team' },
    categories: [{ _type: 'reference' as const, _ref: 'category-ghiduri' }],
  },
  // --- category: educatie ---
  {
    _type: 'blogPost' as const,
    _id: 'blogpost-ce-este-phishing',
    title: 'Ce este phishing-ul și cum îl recunoașteți',
    slug: { _type: 'slug' as const, current: 'ce-este-phishing-ul-si-cum-il-recunoasteti' },
    excerpt:
      'Phishing-ul este cea mai răspândită amenințare cibernetică din România. Învățați să identificați mesajele false și să vă protejați datele personale.',
    body: `Phishing-ul reprezintă o tehnică de inginerie socială prin care atacatorii încearcă să obțină date sensibile — parole, numere de card, coduri PIN — pretinzând că sunt o entitate de încredere. În România, phishing-ul este responsabil pentru peste 40% din toate incidentele de securitate cibernetică raportate către CERT-RO.

Cele mai frecvente scenarii de phishing vizează clienții băncilor românești. Atacatorii trimit e-mailuri sau SMS-uri care par să vină de la ING, BCR, BRD sau Banca Transilvania, informând victimele despre „activitate suspectă" sau „blocarea contului". Mesajul conține un link către o pagină falsă, identică vizual cu site-ul băncii, unde victimele sunt rugați să introducă datele de autentificare.

Cum recunoașteți un mesaj de phishing: verificați adresa expeditorului — băncile folosesc domenii oficiale, nu adrese Gmail sau Yahoo. Fiți atenți la greșelile gramaticale și la tonul de urgență excesivă („contul va fi blocat în 24 de ore"). Nu faceți click pe linkuri din e-mailuri sau SMS-uri — accesați întotdeauna site-ul băncii scriind manual adresa în browser.

Phishing-ul nu se limitează la bănci. Atacatorii vizează și utilizatorii OLX, eMAG, platformelor de curierat (FAN Courier, DPD, Sameday) și chiar ANAF-ul. O campanie recentă imita notificări de la Poșta Română, solicitând o „taxă de procesare" de câțiva lei pentru a livra un colet — suficient pentru a captura datele cardului.

Dacă ați căzut victimă unui atac de phishing, acționați imediat: schimbați parola contului compromis, contactați banca pentru a bloca cardul, activați alerte de tranzacții și raportați incidentul la CERT-RO (cert.ro) și la Poliția Română — Serviciul de Combatere a Criminalității Informatice.`,
    category: 'educatie',
    language: 'ro',
    publishedAt: '2026-03-07T08:00:00Z',
    author: { _type: 'reference' as const, _ref: 'author-aigrija-team' },
    categories: [{ _type: 'reference' as const, _ref: 'category-educatie' }],
  },
  {
    _type: 'blogPost' as const,
    _id: 'blogpost-securitate-mobile',
    title: 'Securitatea dispozitivelor mobile: Sfaturi esențiale',
    slug: { _type: 'slug' as const, current: 'securitatea-dispozitivelor-mobile-sfaturi-esentiale' },
    excerpt:
      'Telefonul dumneavoastră conține mai multe date personale decât orice alt dispozitiv. Descoperiți cum să îl protejați eficient împotriva amenințărilor cibernetice.',
    body: `Dispozitivele mobile au devenit ținta principală a atacatorilor cibernetici, iar România nu face excepție. Cu o rată de penetrare a smartphone-urilor de peste 85%, telefoanele românilor stochează date bancare, conversații private, fotografii personale și acces la conturile de social media — un adevărat tezaur pentru infractori.

Primul pas este să mențineți sistemul de operare și aplicațiile actualizate. Fiecare actualizare conține corecții de securitate pentru vulnerabilități descoperite recent. Configurați actualizările automate atât pentru Android/iOS, cât și pentru aplicațiile instalate. Un telefon cu software vechi este ca o ușă cu lacătul stricat — invită intrușii.

Instalați aplicații doar din surse oficiale: Google Play Store pentru Android și App Store pentru iOS. Evitați descărcarea de APK-uri din site-uri web, grupuri de Telegram sau linkuri primite pe WhatsApp. Aplicațiile din surse neoficiale pot conține malware care vă fură datele, vă înregistrează conversațiile sau vă criptează fișierele pentru răscumpărare (ransomware).

Activați blocarea ecranului cu amprentă digitală, recunoaștere facială sau un PIN de cel puțin 6 cifre. Nu folosiți modele de deblocare simple (pattern) — acestea pot fi observate de persoanele din jur. Activați și opțiunea de ștergere automată după 10 încercări eșuate, precum și funcția „Find My Device" pentru a putea localiza, bloca sau șterge telefonul de la distanță în caz de pierdere sau furt.

Fiți atenți la permisiunile pe care le acordați aplicațiilor. O aplicație de lanternă nu are nevoie de acces la contacte, microfon sau locație. Verificați periodic permisiunile din Setări → Aplicații și revocați accesul inutil. Pe Android, utilizați profilul de lucru (Work Profile) pentru a separa aplicațiile personale de cele profesionale, limitând astfel suprafața de atac.`,
    category: 'educatie',
    language: 'ro',
    publishedAt: '2026-03-04T14:00:00Z',
    author: { _type: 'reference' as const, _ref: 'author-aigrija-team' },
    categories: [{ _type: 'reference' as const, _ref: 'category-educatie' }],
  },
];

const threatReportDocs = [
  {
    _type: 'threatReport' as const,
    _id: 'threat-phishing-ing-martie-2026',
    title: 'Campanie de phishing ING Bank România — Martie 2026',
    slug: { _type: 'slug' as const, current: 'campanie-phishing-ing-bank-romania-martie-2026' },
    severity: 'high',
    threatType: 'phishing',
    affectedEntities: ['ING Bank'],
    excerpt:
      'O campanie masivă de phishing vizează clienții ING Bank România, folosind e-mailuri și SMS-uri false care imită comunicările oficiale ale băncii.',
    content: `O nouă campanie de phishing de amploare vizează clienții ING Bank România din prima săptămână a lunii martie 2026. Atacatorii distribuie e-mailuri și SMS-uri care imită cu fidelitate comunicările oficiale ale băncii, informând destinatarii despre o presupusă „activitate neobișnuită" detectată pe contul lor.

Mesajele conțin un link către un site fals, ing-secure-ro.com, care reproduce perfect interfața ING Home'Bank. Pagina solicită introducerea numelui de utilizator, parolei și a codului primit prin SMS — permițând atacatorilor să preia controlul complet asupra contului victimei. Domeniul malițios a fost înregistrat pe 28 februarie 2026 și utilizează un certificat SSL valid, ceea ce face detecția vizuală dificilă.

Analiza tehnică a campaniei relevă utilizarea unui kit de phishing de tip „man-in-the-middle" care interceptează sesiunea în timp real, ocolind astfel autentificarea în doi pași. Atacatorii operează din infrastructură găzduită pe servere din Europa de Est, cu IP-uri rotative și domenii generate algoritmic (DGA).

CERT-RO a emis o alertă oficială (CERT-RO-2026-0312) și colaborează cu ING Bank pentru blocarea domeniilor implicate. Până în prezent, au fost identificate peste 2.000 de tentative de acces la pagina falsă de la IP-uri românești. Banca a confirmat că nu trimite niciodată linkuri directe către pagina de autentificare prin e-mail sau SMS.

Recomandări: nu accesați linkuri din e-mailuri sau SMS-uri presupus de la bancă, verificați întotdeauna adresa URL (ing.ro este singurul domeniu oficial), activați notificările push pentru tranzacții și raportați mesajele suspecte la phishing@ing.ro și la CERT-RO.`,
    body: `O nouă campanie de phishing de amploare vizează clienții ING Bank România din prima săptămână a lunii martie 2026. Atacatorii distribuie e-mailuri și SMS-uri care imită cu fidelitate comunicările oficiale ale băncii, informând destinatarii despre o presupusă „activitate neobișnuită" detectată pe contul lor.

Mesajele conțin un link către un site fals, ing-secure-ro.com, care reproduce perfect interfața ING Home'Bank. Pagina solicită introducerea numelui de utilizator, parolei și a codului primit prin SMS — permițând atacatorilor să preia controlul complet asupra contului victimei. Domeniul malițios a fost înregistrat pe 28 februarie 2026 și utilizează un certificat SSL valid, ceea ce face detecția vizuală dificilă.

Analiza tehnică a campaniei relevă utilizarea unui kit de phishing de tip „man-in-the-middle" care interceptează sesiunea în timp real, ocolind astfel autentificarea în doi pași. Atacatorii operează din infrastructură găzduită pe servere din Europa de Est, cu IP-uri rotative și domenii generate algoritmic (DGA).

CERT-RO a emis o alertă oficială (CERT-RO-2026-0312) și colaborează cu ING Bank pentru blocarea domeniilor implicate. Până în prezent, au fost identificate peste 2.000 de tentative de acces la pagina falsă de la IP-uri românești. Banca a confirmat că nu trimite niciodată linkuri directe către pagina de autentificare prin e-mail sau SMS.

Recomandări: nu accesați linkuri din e-mailuri sau SMS-uri presupus de la bancă, verificați întotdeauna adresa URL (ing.ro este singurul domeniu oficial), activați notificările push pentru tranzacții și raportați mesajele suspecte la phishing@ing.ro și la CERT-RO.`,
    firstSeen: '2026-03-02T06:00:00Z',
    publishedAt: '2026-03-03T12:00:00Z',
    language: 'ro',
    categories: [{ _type: 'reference' as const, _ref: 'category-amenintari' }],
  },
  {
    _type: 'threatReport' as const,
    _id: 'threat-malware-emag-facturi',
    title: 'Malware distribuit prin facturi false eMAG',
    slug: { _type: 'slug' as const, current: 'malware-distribuit-prin-facturi-false-emag' },
    severity: 'high',
    threatType: 'malware',
    affectedEntities: ['eMAG'],
    excerpt:
      'Atacatorii distribuie malware prin e-mailuri care imită facturi eMAG, conținând atașamente PDF infectate cu troian bancar.',
    content: `O campanie de distribuție de malware utilizează facturi false care par să provină de la eMAG, cel mai mare retailer online din România. E-mailurile, trimise de pe adrese care imită domeniul oficial (factura@emag-romania.com), conțin atașamente PDF care, la deschidere, instalează un troian bancar pe dispozitivul victimei.

Malware-ul identificat este o variantă a troianului Grandoreiro, adaptat pentru băncile din Europa de Est. Odată instalat, acesta monitorizează activitatea browserului și interceptează datele de autentificare atunci când victima accesează site-urile băncilor românești. Troianul poate de asemenea să suprapună ferestre false peste aplicațiile bancare mobile.

Campania exploatează obișnuința românilor de a primi facturi electronice de la eMAG. E-mailurile sunt bine construite, conțin logo-ul oficial, un număr de comandă plauzibil și o sumă de plată realistă. Atașamentul PDF conține cod JavaScript obfuscat care descarcă payload-ul malițios de pe servere compromise din Turcia și Ucraina.

Indicatorii de compromitere (IoC) au fost partajați cu companiile de antivirus și cu CERT-RO. Recomandăm utilizatorilor să nu deschidă atașamente din e-mailuri nesolicitate, să verifice comenzile direct pe site-ul emag.ro și să mențină antivirusul actualizat. eMAG a confirmat că facturile oficiale sunt disponibile exclusiv în contul de utilizator de pe platformă, nu prin e-mail.

Dacă ați deschis un astfel de atașament, deconectați imediat dispozitivul de la internet, efectuați o scanare completă cu antivirusul, schimbați parolele conturilor bancare de pe un alt dispozitiv și contactați banca pentru monitorizarea tranzacțiilor suspecte.`,
    body: `O campanie de distribuție de malware utilizează facturi false care par să provină de la eMAG, cel mai mare retailer online din România. E-mailurile, trimise de pe adrese care imită domeniul oficial (factura@emag-romania.com), conțin atașamente PDF care, la deschidere, instalează un troian bancar pe dispozitivul victimei.

Malware-ul identificat este o variantă a troianului Grandoreiro, adaptat pentru băncile din Europa de Est. Odată instalat, acesta monitorizează activitatea browserului și interceptează datele de autentificare atunci când victima accesează site-urile băncilor românești. Troianul poate de asemenea să suprapună ferestre false peste aplicațiile bancare mobile.

Campania exploatează obișnuința românilor de a primi facturi electronice de la eMAG. E-mailurile sunt bine construite, conțin logo-ul oficial, un număr de comandă plauzibil și o sumă de plată realistă. Atașamentul PDF conține cod JavaScript obfuscat care descarcă payload-ul malițios de pe servere compromise din Turcia și Ucraina.

Indicatorii de compromitere (IoC) au fost partajați cu companiile de antivirus și cu CERT-RO. Recomandăm utilizatorilor să nu deschidă atașamente din e-mailuri nesolicitate, să verifice comenzile direct pe site-ul emag.ro și să mențină antivirusul actualizat. eMAG a confirmat că facturile oficiale sunt disponibile exclusiv în contul de utilizator de pe platformă, nu prin e-mail.

Dacă ați deschis un astfel de atașament, deconectați imediat dispozitivul de la internet, efectuați o scanare completă cu antivirusul, schimbați parolele conturilor bancare de pe un alt dispozitiv și contactați banca pentru monitorizarea tranzacțiilor suspecte.`,
    firstSeen: '2026-03-05T14:30:00Z',
    publishedAt: '2026-03-06T09:00:00Z',
    language: 'ro',
    categories: [{ _type: 'reference' as const, _ref: 'category-amenintari' }],
  },
];

const weeklyDigestDoc = {
  _type: 'weeklyDigest' as const,
  _id: 'digest-2026-w10',
  title: 'Raport săptămânal: 3-9 Martie 2026',
  slug: { _type: 'slug' as const, current: 'raport-saptamanal-3-9-martie-2026' },
  excerpt:
    'Rezumatul săptămânal al amenințărilor cibernetice din România: campanie phishing ING, malware via facturi eMAG, și actualizări de securitate critice.',
  body: `Săptămâna 3-9 martie 2026 a fost marcată de două campanii majore care au vizat utilizatorii români de internet. AI Grija a monitorizat și analizat aceste amenințări pentru a oferi comunității informații actualizate și recomandări practice.

Campania de phishing ING Bank: Cea mai semnificativă amenințare a săptămânii a fost o campanie coordonată de phishing care a vizat clienții ING Bank România. Atacatorii au utilizat un kit avansat de tip man-in-the-middle capabil să ocolească autentificarea în doi pași. CERT-RO a emis alerta CERT-RO-2026-0312, iar domeniul malițios a fost blocat în colaborare cu registrarul. Estimăm că peste 2.000 de utilizatori au fost expuși.

Malware prin facturi false eMAG: O a doua campanie a distribuit troianul Grandoreiro prin e-mailuri care imitau facturi eMAG. Payload-ul era ascuns în atașamente PDF cu JavaScript obfuscat. Troianul vizează specific aplicațiile bancare din România, interceptând datele de autentificare. eMAG a confirmat că facturile oficiale nu sunt trimise prin e-mail.

Actualizări de securitate recomandate: Microsoft a lansat patch-ul de securitate lunar (Patch Tuesday) pe 4 martie, remediind 12 vulnerabilități critice, inclusiv două exploatate activ (zero-day) în Windows Defender și Microsoft Outlook. Apple a lansat iOS 19.3.2 cu corecții pentru 3 vulnerabilități WebKit. Recomandăm actualizarea imediată a tuturor dispozitivelor.

Statistici AI Grija: în această săptămână am procesat 1.247 de raportări de la utilizatori, am blocat 89 de domenii de phishing și am emis 5 alerte în timp real prin canalele noastre Telegram și WhatsApp. Cele mai raportate branduri abuzate au fost ING Bank (34%), eMAG (22%), OLX (18%) și Poșta Română (12%).`,
  language: 'ro',
  publishedAt: '2026-03-09T18:00:00Z',
  categories: [{ _type: 'reference' as const, _ref: 'category-amenintari' }],
};

// ---------------------------------------------------------------------------
// Sanity mutations API call
// ---------------------------------------------------------------------------

type SanityDoc = Record<string, unknown>;

async function seedDocuments(docs: SanityDoc[]): Promise<void> {
  const url = `https://${PROJECT_ID}.api.sanity.io/${SANITY_API_VERSION}/data/mutate/${DATASET}`;
  const mutations = docs.map((doc) => ({ createOrReplace: doc }));

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ mutations }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sanity API error ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as { results?: { id: string; operation: string }[] };
  const results = data.results ?? [];
  console.log(`  Seeded ${results.length} document(s)`);
  for (const r of results) {
    console.log(`    ${r.operation}: ${r.id}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`Seeding content to Sanity project=${PROJECT_ID} dataset=${DATASET}\n`);

  console.log('1/5 Author...');
  await seedDocuments([authorDoc]);

  console.log('2/5 Categories...');
  await seedDocuments(categoryDocs);

  console.log('3/5 Blog posts (ghid + educatie)...');
  await seedDocuments(blogPostDocs);

  console.log('4/5 Threat reports...');
  await seedDocuments(threatReportDocs);

  console.log('5/5 Weekly digest...');
  await seedDocuments([weeklyDigestDoc]);

  console.log('\nDone. Seeded 1 author, 3 categories, 4 blog posts, 2 threat reports, 1 weekly digest.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
