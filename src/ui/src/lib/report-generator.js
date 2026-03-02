/**
 * Client-side Report Packet Generator
 * PRD §3.7 — KILLER FEATURE
 *
 * All identity data stays client-side. ZERO network calls.
 */

const today = () => new Date().toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });

function buildAddress(identity) {
  const { domiciliu_judet, domiciliu_localitate, domiciliu_strada, domiciliu_nr,
    domiciliu_bloc, domiciliu_scara, domiciliu_apartament, domiciliu_sector } = identity;
  let addr = '';
  if (domiciliu_judet) addr += domiciliu_judet;
  if (domiciliu_localitate) addr += (addr ? ', ' : '') + domiciliu_localitate;
  if (domiciliu_sector) addr += (addr ? ', Sector ' : 'Sector ') + domiciliu_sector;
  if (domiciliu_strada) addr += (addr ? ', str. ' : 'str. ') + domiciliu_strada;
  if (domiciliu_nr) addr += ' nr. ' + domiciliu_nr;
  if (domiciliu_bloc) addr += ', bl. ' + domiciliu_bloc;
  if (domiciliu_scara) addr += ', sc. ' + domiciliu_scara;
  if (domiciliu_apartament) addr += ', ap. ' + domiciliu_apartament;
  return addr || '[ADRESĂ NECOMPLETATĂ]';
}

function redFlagsAsBullets(red_flags) {
  if (!red_flags || red_flags.length === 0) return '  - (nespecificate)';
  return red_flags.map(f => '  - ' + f).join('\n');
}

function urlsFromVerdict(verdict) {
  if (verdict.url) return verdict.url;
  return '(niciun URL identificat)';
}

function channelFromVerdict(verdict) {
  return verdict.channel || 'necunoscut';
}

function impersonatedEntity(verdict) {
  return verdict.impersonated_entity || verdict.scam_type || 'entitate necunoscută';
}

/**
 * Generate a report document.
 *
 * @param {'plangere-penala'|'petitie-politie'|'raport-dnsc'|'sesizare-banca'} type
 * @param {object} verdict — classification result from API
 * @param {object} identity — UserIdentity shape
 * @returns {string} — the filled report text
 */
export function generateReport(type, verdict, identity) {
  switch (type) {
    case 'plangere-penala':
      return templatePlangere(verdict, identity);
    case 'petitie-politie':
      return templatePetitiePolitie(verdict, identity);
    case 'raport-dnsc':
      return templateRaportDNSC(verdict, identity);
    case 'sesizare-banca':
      return templateSesizareBanca(verdict, identity);
    default:
      return '';
  }
}

function templatePlangere(verdict, identity) {
  const prenume = identity.prenume || '';
  const nume = identity.nume || '';
  const tata_prenume = identity.tata_prenume || '[tată]';
  const mama_prenume = identity.mama_prenume || '[mamă]';
  const ci_seria = identity.ci_seria || '??';
  const ci_nr = identity.ci_nr || '?????';
  const cnp = identity.cnp || '[CNP]';
  const telefon = identity.telefon || '[telefon]';
  const email = identity.email || '[email]';
  const adresa = buildAddress(identity);
  const data = today();

  return 'DOMNULE PRIM-PROCUROR,\n\n' +
    'Subsemnatul(a) ' + prenume + ' ' + nume + ', fiul/fiica lui ' + tata_prenume + ' și al(a) ' + mama_prenume + ',\n' +
    'domiciliat(ă) în ' + adresa + ',\n' +
    'identificat(ă) cu CI seria ' + ci_seria + ' nr. ' + ci_nr + ',\n' +
    'CNP ' + cnp + ',\n' +
    'telefon: ' + telefon + ',\n' +
    'email: ' + email + ',\n\n' +
    'în temeiul art. 221 din Codul de Procedură Penală, vă aduc la cunoștință următoarele:\n\n' +
    'SITUAȚIA DE FAPT:\n' +
    'În data de ' + data + ', am fost ținta unei tentative de fraudă informatică (phishing):\n' +
    (verdict.explanation || '[descriere fraudă]') + '\n\n' +
    'Canal de contact: ' + channelFromVerdict(verdict) + '\n' +
    'Entitate impersonată: ' + impersonatedEntity(verdict) + '\n' +
    'URL-uri suspecte: ' + urlsFromVerdict(verdict) + '\n\n' +
    'Indicii de fraudă identificate:\n' +
    redFlagsAsBullets(verdict.red_flags) + '\n\n' +
    'ÎNCADRARE JURIDICĂ ORIENTATIVĂ:\n' +
    '- Fraudă informatică (art. 249 Cod Penal)\n' +
    '- Efectuarea de operațiuni financiare în mod fraudulos (art. 250 Cod Penal)\n' +
    '- Fals informatic (art. 325 Cod Penal)\n' +
    '- Înșelăciune (art. 244 Cod Penal)\n\n' +
    'SOLICIT tragerea la răspundere penală a făptuitorului/făptuitorilor.\n' +
    'Mă constitui parte vătămată în procesul penal.\n\n' +
    'MIJLOACE DE PROBĂ:\n' +
    '- Captură de ecran / mesajul original (atașat)\n' +
    '- Raport de analiză automată ai-grija.ro (informativ, nu constituie expertiză)\n\n' +
    'Data: ' + data + '\n' +
    'Semnătura: ____________________\n\n' +
    '---\n' +
    'Raport generat de ai-grija.ro — un proiect civic Zen Labs.\n' +
    'Depuneți la: Parchetul de pe lângă Judecătoria competentă sau la secția de poliție din raza domiciliului.\n';
}

function templatePetitiePolitie(verdict, identity) {
  const prenume = identity.prenume || '';
  const nume = identity.nume || '';
  const cnp = identity.cnp || '[CNP]';
  const telefon = identity.telefon || '[telefon]';
  const email = identity.email || '[email]';
  const adresa = buildAddress(identity);
  const judet = identity.domiciliu_judet || '[județ]';
  const data = today();

  return 'PETIȚIE — POLIȚIA ROMÂNĂ\n' +
    '(Format pentru depunere online la politiaromana.ro/ro/petitii-online)\n\n' +
    'DATE PETIȚIONAR:\n' +
    'Nume și prenume: ' + prenume + ' ' + nume + '\n' +
    'CNP: ' + cnp + '\n' +
    'Adresă domiciliu: ' + adresa + '\n' +
    'Județ: ' + judet + '\n' +
    'Telefon: ' + telefon + '\n' +
    'E-mail: ' + email + '\n\n' +
    'TIPUL SESIZĂRII: Fraudă informatică / Înșelăciune online\n\n' +
    'DESCRIEREA FAPTEI:\n\n' +
    'La data de ' + data + ' am fost victima/potențiala victimă a unei tentative\n' +
    'de fraudă de tip "' + (verdict.scam_type || 'phishing') + '".\n\n' +
    (verdict.explanation || '[descriere fraudă]') + '\n\n' +
    'Entitate impersonată: ' + impersonatedEntity(verdict) + '\n' +
    (verdict.url ? 'Link/URL folosit în fraudă: ' + verdict.url + '\n' : '') + '\n' +
    'Indicii de fraudă identificate:\n' +
    redFlagsAsBullets(verdict.red_flags) + '\n\n' +
    'PREJUDICIUL SUFERIT:\n' +
    '☐ Tentativă (nu am transferat bani/date)\n' +
    '☐ Prejudiciu financiar: [COMPLETAȚI suma]\n' +
    '☐ Date personale compromise: [COMPLETAȚI ce date]\n' +
    '☐ Altele: [COMPLETAȚI]\n\n' +
    'MIJLOACE DE PROBĂ ATAȘATE:\n' +
    '[x] Captură ecran mesaj fraudulos\n' +
    '[x] Raport analiză ai-grija.ro\n' +
    '[ ] Dovadă transfer bancar (dacă există)\n\n' +
    'Solicit efectuarea de verificări și luarea măsurilor legale ce se impun.\n\n' +
    'Data: ' + data + '\n' +
    'Semnătura: ____________________\n\n' +
    '---\n' +
    'Depuneți online la: https://www.politiaromana.ro/ro/petitii-online\n' +
    'Sau fizic la: secția de poliție din raza domiciliului dumneavoastră.\n' +
    'Document generat prin ai-grija.ro — un proiect civic Zen Labs.\n';
}

function templateRaportDNSC(verdict, identity) {
  const prenume = identity.prenume || '';
  const nume = identity.nume || '';
  const telefon = identity.telefon || '[opțional]';
  const email = identity.email || '[opțional]';
  const data = today();

  return 'RAPORT INCIDENT DE SECURITATE CIBERNETICĂ\n' +
    'Destinatar: DNSC — Directoratul Național de Securitate Cibernetică\n' +
    'Adresă e-mail: alerts@dnsc.ro\n' +
    'Depunere online: https://pnrisc.dnsc.ro\n\n' +
    'INFORMAȚII INCIDENT:\n\n' +
    'Data și ora incidentului: ' + data + '\n' +
    'Tipul incidentului: Fraudă online / Phishing / ' + (verdict.scam_type || 'phishing') + '\n' +
    'Clasificare automată: ' + (verdict.verdict || 'phishing') + ' (' + (verdict.confidence || '?') + '% încredere)\n\n' +
    'DESCRIERE TEHNICĂ:\n\n' +
    'Tipul atacului: ' + (verdict.scam_type || 'phishing') + '\n' +
    'Entitate impersonată: ' + impersonatedEntity(verdict) + '\n' +
    (verdict.url ? 'URL/domeniu malițios identificat: ' + verdict.url + '\n' : 'URL: neidentificat / comunicare prin mesaj direct\n') + '\n' +
    (verdict.explanation || '[descriere fraudă]') + '\n\n' +
    'Indicii tehnice de fraudă:\n' +
    redFlagsAsBullets(verdict.red_flags) + '\n\n' +
    'Metoda de contact a atacatorului:\n' +
    '☐ SMS  ☐ E-mail  ☐ WhatsApp  ☐ Telegram  ☐ Apel telefonic  ☐ Altele\n' +
    '[BIFAȚI metoda corespunzătoare]\n\n' +
    'IMPACTUL INCIDENTULUI:\n' +
    '☐ Tentativă — nicio acțiune din partea victimei\n' +
    '☐ Date de autentificare compromise\n' +
    '☐ Date bancare compromise\n' +
    '☐ Prejudiciu financiar: [COMPLETAȚI suma dacă există]\n\n' +
    'INFORMAȚII RAPORTANT:\n' +
    'Nume: ' + prenume + ' ' + nume + '\n' +
    'E-mail contact: ' + email + '\n' +
    'Telefon: ' + telefon + '\n\n' +
    'DOVEZI TEHNICE ATAȘATE:\n' +
    '1. Captură ecran conținut fraudulos (fișier atașat)\n' +
    '2. Raport analiză ai-grija.ro (fișier atașat)\n' +
    (verdict.url ? '3. Informații whois/DNS pentru URL-ul fraudulos (dacă disponibile)\n' : '') + '\n' +
    'Data raportului: ' + data + '\n\n' +
    '---\n' +
    'DNSC procesează rapoartele și poate emite alerte publice pentru a proteja alți utilizatori.\n' +
    'Document generat prin ai-grija.ro — un proiect civic Zen Labs.\n';
}

function templateSesizareBanca(verdict, identity) {
  const prenume = identity.prenume || '';
  const nume = identity.nume || '';
  const cnp = identity.cnp || '[CNP]';
  const telefon = identity.telefon || '[telefon]';
  const email = identity.email || '[email]';
  const adresa = buildAddress(identity);
  const data = today();
  const banca = verdict.bank_name || '[COMPLETAȚI NUMELE BĂNCII]';

  return 'SESIZARE FRAUDĂ BANCARĂ\n\n' +
    'Către: ' + banca + '\n' +
    'Departamentul de Prevenire a Fraudelor\n\n' +
    'DATE CLIENT:\n' +
    'Nume și prenume: ' + prenume + ' ' + nume + '\n' +
    'CNP: ' + cnp + '\n' +
    'Adresă: ' + adresa + '\n' +
    'Telefon: ' + telefon + '\n' +
    'E-mail: ' + email + '\n' +
    'Nr. contract/client: [COMPLETAȚI]\n' +
    'IBAN cont afectat: [COMPLETAȚI]\n\n' +
    'OBIECT: Sesizare tentativă de fraudă / fraudă confirmată\n\n' +
    'Stimate doamnă/domn,\n\n' +
    'Prin prezenta vă sesizez cu privire la o tentativă de fraudă/fraudă\n' +
    'îndreptată împotriva mea' + (banca !== '[COMPLETAȚI NUMELE BĂNCII]' ? ', în care se uzurpă identitatea băncii ' + banca : '') + '.\n\n' +
    'DETALII INCIDENT:\n\n' +
    'Data incidentului: ' + data + '\n' +
    'Tipul fraudei: ' + (verdict.scam_type || 'phishing') + ' (verdict: ' + (verdict.verdict || 'phishing') + ')\n\n' +
    (verdict.explanation || '[descriere fraudă]') + '\n\n' +
    (verdict.url ? 'URL fraudulos folosit: ' + verdict.url + '\n\n' : '') +
    'Indicii identificate:\n' +
    redFlagsAsBullets(verdict.red_flags) + '\n\n' +
    'ACȚIUNI EFECTUATE DE CLIENT (bifați):\n' +
    '☐ Nu am furnizat date bancare\n' +
    '☐ Am accesat link-ul din mesaj\n' +
    '☐ Am furnizat datele cardului\n' +
    '☐ Am furnizat codul OTP/PIN\n' +
    '☐ Am efectuat transfer bancar\n' +
    '  Suma: [COMPLETAȚI]\n' +
    '  IBAN destinatar: [COMPLETAȚI]\n' +
    '  Data tranzacției: [COMPLETAȚI]\n\n' +
    'SOLICITĂRI:\n' +
    '☐ Blocarea cardului/contului ca măsură preventivă\n' +
    '☐ Investigarea tranzacțiilor suspecte\n' +
    '☐ Inițierea procedurii de chargeback (dacă este cazul)\n' +
    '☐ Altele: [COMPLETAȚI]\n\n' +
    'Atașez prezentei sesizări dovezile disponibile (capturi ecran, raport ai-grija.ro).\n\n' +
    'Cu stimă,\n' +
    prenume + ' ' + nume + '\n' +
    'Data: ' + data + '\n' +
    'Semnătura: ____________________\n\n' +
    '---\n' +
    'Contactați URGENT linia antifraudă a băncii pentru blocare imediată a cardului.\n' +
    'Document generat prin ai-grija.ro — un proiect civic Zen Labs.\n';
}
