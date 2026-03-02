export function templatePlangere(p) {
    return `PLÂNGERE PENALĂ

Subsemnatul/Subsemnata [COMPLETAȚI NUMELE COMPLET], cetățean/cetățeancă român/ă,
domiciliat/ă în [COMPLETAȚI ADRESA COMPLETĂ], posesor/posesoare al/a C.I./B.I.
seria [COMPLETAȚI] nr. [COMPLETAȚI], CNP [COMPLETAȚI],
telefon [COMPLETAȚI], e-mail [COMPLETAȚI],

formulez prezenta

PLÂNGERE PENALĂ

împotriva autorilor necunoscuți ai faptei de înșelăciune în formă agravată,
prevăzută și pedepsită de art. 244 alin. (1) și (2) din Codul Penal.

I. SITUAȚIA DE FAPT

La data de ${p.date}, am primit un mesaj cu caracter fraudulos clasificat
drept "${p.scam_type}" (verdict sistem: ${p.verdict}).

Conținutul mesajului (extras): "${p.text_excerpt}"
${p.url ? `URL identificat: ${p.url}` : ''}

Autorii necunoscuți au folosit metode de inducere în eroare specifice
fraudelor de tip ${p.scam_type}, cu scopul de a obține foloase materiale
necuvenite prin prezentarea de date false.

II. DAUNE SUFERITE

[COMPLETAȚI: descrieți daunele materiale și/sau morale suferite]
Suma prejudiciată (dacă este cazul): [COMPLETAȚI sau N/A]

III. PROBE

Atașez prezentei plângeri:
1. Captură ecran a mesajului fraudulos (Anexa 1)
2. Raportul de analiză generat de ai-grija.ro (Anexa 2)
${p.url ? '3. Captură ecran a URL-ului fraudulos (Anexa 3)' : ''}
[COMPLETAȚI: orice alte probe relevante]

IV. SOLICITARE

Solicit efectuarea urmăririi penale față de autorii necunoscuți ai faptei
de înșelăciune, identificarea și tragerea la răspundere penală a acestora,
conform prevederilor Codului de Procedură Penală.

Declar că cele menționate sunt conforme cu realitatea și îmi asum
răspunderea pentru veridicitatea datelor furnizate, conform art. 326 C.pen.

Data: ${p.date}
Semnătura: [COMPLETAȚI]

---
Document generat prin ai-grija.ro — platformă de protecție împotriva fraudelor online.
---
Raport generat de ai-grija.ro — un proiect civic Zen Labs.
Completați toate câmpurile marcate cu [COMPLETAȚI] înainte de depunere.
Depuneți la: Parchetul de pe lângă Judecătoria competentă sau la secția de poliție din raza domiciliului.
`;
}
export function templatePetitiePolitie(p) {
    return `PETIȚIE — POLIȚIA ROMÂNĂ
(Format pentru depunere online la politiaromana.ro)

DATE PETIȚIONAR:
Nume și prenume: [COMPLETAȚI NUMELE COMPLET]
CNP: [COMPLETAȚI]
Adresă domiciliu: [COMPLETAȚI ADRESA COMPLETĂ]
Județ: [COMPLETAȚI]
Telefon: [COMPLETAȚI]
E-mail: [COMPLETAȚI]

TIPUL SESIZĂRII: Fraudă informatică / Înșelăciune online

DESCRIEREA FAPTEI:

La data de ${p.date} am fost victima/potențiala victimă a unei tentative
de fraudă de tip "${p.scam_type}".

Mesajul/conținutul fraudulos (extras primele 200 de caractere):
"${p.text_excerpt}"

${p.url ? `Link/URL folosit în fraudă: ${p.url}` : ''}

Analiza automată efectuată prin platforma ai-grija.ro a clasificat
acest conținut ca: ${p.verdict} — ${p.scam_type}.

PREJUDICIUL SUFERIT:
☐ Tentativă (nu am transferat bani/date)
☐ Prejudiciu financiar: [COMPLETAȚI suma]
☐ Date personale compromise: [COMPLETAȚI ce date]
☐ Altele: [COMPLETAȚI]

DATE CONT BANCAR VICTIMĂ (dacă este cazul):
Bancă: ${p.bank_name || '[COMPLETAȚI dacă este relevant]'}
IBAN: [COMPLETAȚI dacă doriți recuperarea fondurilor]

MIJLOACE DE PROBĂ ATAȘATE:
[x] Captură ecran mesaj fraudulos
[x] Raport analiză ai-grija.ro
[ ] Dovadă transfer bancar (dacă există)
[ ] Alte înscrisuri: [COMPLETAȚI]

Solicit efectuarea de verificări și luarea măsurilor legale ce se impun.

Data: ${p.date}
Semnătura electronică/olografă: [COMPLETAȚI]

---
Depuneți online la: https://www.politiaromana.ro/ro/petitii
Sau fizic la: secția de poliție din raza domiciliului dumneavoastră.
Document generat prin ai-grija.ro.
---
Raport generat de ai-grija.ro — un proiect civic Zen Labs.
`;
}
export function templateRaportDNSC(p) {
    return `RAPORT INCIDENT DE SECURITATE CIBERNETICĂ
Destinatar: DNSC — Directoratul Național de Securitate Cibernetică
Adresă depunere online: https://dnsc.ro/raportare

INFORMAȚII INCIDENT:

Data și ora incidentului: ${p.date}
Tipul incidentului: Fraudă online / Phishing / ${p.scam_type}
Clasificare automată: ${p.verdict}

DESCRIERE TEHNICĂ:

Tipul atacului: ${p.scam_type}
${p.url ? `URL/domeniu malițios identificat: ${p.url}` : 'URL: neidentificat / comunicare prin mesaj direct'}

Conținut mesaj fraudulos (extras):
"${p.text_excerpt}"

Metoda de contact a atacatorului:
☐ SMS  ☐ E-mail  ☐ WhatsApp  ☐ Telegram  ☐ Apel telefonic  ☐ Altele
[BIFAȚI metoda corespunzătoare]

IMPACTUL INCIDENTULUI:
☐ Tentativă — nicio acțiune din partea victimei
☐ Date de autentificare compromise
☐ Date bancare compromise
☐ Prejudiciu financiar: [COMPLETAȚI suma dacă există]

INFORMAȚII RAPORTANT:
Nume/Organizație: [COMPLETAȚI — poate fi anonim]
E-mail contact: [COMPLETAȚI — opțional]
Telefon: [COMPLETAȚI — opțional]

DOVEZI TEHNICE ATAȘATE:
1. Captură ecran conținut fraudulos (fișier atașat)
2. Raport analiză ai-grija.ro (fișier atașat)
${p.url ? '3. Informații whois/DNS pentru URL-ul fraudulos (dacă disponibile)' : ''}

INFORMAȚII SUPLIMENTARE:
[COMPLETAȚI orice alte detalii tehnice relevante: header-e e-mail, numere de telefon,
conturi de social media ale atacatorilor etc.]

Data raportului: ${p.date}

---
DNSC procesează rapoartele și poate emite alerte publice pentru a proteja alți utilizatori.
Document generat prin ai-grija.ro — platformă de protecție împotriva fraudelor online.
---
Raport generat de ai-grija.ro — un proiect civic Zen Labs.
`;
}
export function templateSesizareBanca(p) {
    const banca = p.bank_name || '[COMPLETAȚI NUMELE BĂNCII]';
    return `SESIZARE FRAUDĂ BANCARĂ

Către: ${banca}
Departamentul de Prevenire a Fraudelor

DATE CLIENT:
Nume și prenume: [COMPLETAȚI NUMELE COMPLET]
CNP: [COMPLETAȚI]
Nr. contract/client: [COMPLETAȚI]
IBAN cont afectat: [COMPLETAȚI]
Telefon: [COMPLETAȚI]
E-mail: [COMPLETAȚI]

OBIECT: Sesizare tentativă de fraudă / fraudă confirmată

Stimate doamnă/domn,

Prin prezenta vă sesizez cu privire la o tentativă de fraudă/fraudă
îndreptată împotriva mea, în care se uzurpă identitatea băncii ${banca}
sau în care am efectuat/am fost solicitat să efectuez operațiuni bancare
ca urmare a unui mesaj fraudulos.

DETALII INCIDENT:

Data incidentului: ${p.date}
Tipul fraudei: ${p.scam_type} (verdict: ${p.verdict})

Descrierea mesajului primit (extras):
"${p.text_excerpt}"

${p.url ? `URL fraudulos folosit: ${p.url}` : ''}

ACȚIUNI EFECTUATE DE CLIENT (bifați):
☐ Nu am furnizat date bancare
☐ Am accesat link-ul din mesaj
☐ Am furnizat datele cardului
☐ Am furnizat codul OTP/PIN
☐ Am efectuat transfer bancar
  Suma: [COMPLETAȚI]
  IBAN destinatar: [COMPLETAȚI]
  Data tranzacției: [COMPLETAȚI]
  Referință tranzacție: [COMPLETAȚI]

SOLICITĂRI:
☐ Blocarea cardului/contului ca măsură preventivă
☐ Investigarea tranzacțiilor suspecte
☐ Inițierea procedurii de chargeback (dacă este cazul)
☐ Informații despre contul destinatar al transferului fraudulos
☐ Altele: [COMPLETAȚI]

Atașez prezentei sesizări dovezile disponibile (capturi ecran, raport ai-grija.ro).

Solicit confirmarea primirii acestei sesizări și informarea cu privire
la măsurile luate.

Cu stimă,
[COMPLETAȚI NUMELE COMPLET]
Data: ${p.date}
Semnătura: [COMPLETAȚI]

---
Depuneți la: ghișeul băncii, e-mail departament fraude, sau prin aplicația bancară.
Contactați și linia antifraudă a băncii pentru blocare urgentă a cardului.
Document generat prin ai-grija.ro — platformă de protecție împotriva fraudelor online.
---
Raport generat de ai-grija.ro — un proiect civic Zen Labs.
`;
}
export const REPORT_INSTRUCTIONS = {
    'plangere-penala': 'Completați câmpurile marcate cu [COMPLETAȚI], atașați capturi ecran și depuneți personal sau prin poștă la Parchetul de pe lângă Judecătoria din raza domiciliului dumneavoastră. Păstrați o copie ștampilată.',
    'petitie-politie': 'Depuneți online la politiaromana.ro/petitii sau la secția de poliție din raza domiciliului. Veți primi un număr de înregistrare în 24-48 ore.',
    'raport-dnsc': 'Trimiteți raportul la dnsc.ro/raportare. DNSC poate emite alerte publice pentru a proteja alți utilizatori. Raportarea este confidențială.',
    'sesizare-banca': 'Contactați URGENT banca prin telefon (linia antifraudă) pentru blocare imediată, apoi depuneți sesizarea scrisă. Fiecare minut contează în recuperarea fondurilor.',
};
export function generateReport(type, params) {
    let template;
    switch (type) {
        case 'plangere-penala':
            template = templatePlangere(params);
            break;
        case 'petitie-politie':
            template = templatePetitiePolitie(params);
            break;
        case 'raport-dnsc':
            template = templateRaportDNSC(params);
            break;
        case 'sesizare-banca':
            template = templateSesizareBanca(params);
            break;
    }
    return { template, instructions: REPORT_INSTRUCTIONS[type] };
}
