import type { BankPlaybook } from '../lib/types';

export const BANK_PLAYBOOKS: Record<string, BankPlaybook> = {
  'ING Romania': {
    official_domain: 'ing.ro',
    fraud_phone: '*4000',
    fraud_page: 'https://ing.ro/ing-in-romania/informatii-utile/securitate/phishing-smishing',
    spoofing_page: 'https://ing.ro/ing-in-romania/informatii-utile/securitate/spoofing',
    key_facts: [
      'ING nu solicita niciodata date personale prin SMS, email sau apel',
      'ING nu trimite linkuri prin SMS catre HomeBank',
      'ING nu va cere niciodata PIN-ul, parola sau codul de autorizare',
      'Functia "Inchide-i Apelul Fraudei" e disponibila in aplicatie',
    ],
    if_compromised: [
      'Blocheaza cardul imediat din aplicatia ING',
      'Suna *4000 (Contact Center ING)',
      'Schimba parola HomeBank',
      'Raporteaza la DNSC (1911)',
      'Depune plangere la Politie',
    ],
  },
  'BCR': {
    official_domain: 'bcr.ro',
    fraud_phone: '*2227',
    fraud_page: 'https://www.bcr.ro/ro/securitate',
    key_facts: ['BCR nu solicita date confidentiale prin canale neoficiale'],
    if_compromised: ['Blocheaza cardul din George', 'Suna *2227', 'Raporteaza la DNSC (1911)'],
  },
  'BRD': {
    official_domain: 'brd.ro',
    fraud_phone: '021.302.6161',
    fraud_page: 'https://www.brd.ro/securitate',
    key_facts: ['BRD nu cere niciodata date personale prin email sau SMS'],
    if_compromised: ['Blocheaza cardul din MyBRD', 'Suna 021.302.6161', 'Raporteaza la DNSC (1911)'],
  },

  'Banca Transilvania': {
    official_domain: 'bt.ro',
    fraud_phone: '0264-308 028',
    fraud_page: 'https://www.bt.ro/securitate',
    key_facts: [
      'BT nu solicita niciodata date de autentificare prin SMS sau email',
      'BT24 se acceseaza exclusiv prin bt24.ro',
      'BT nu trimite link-uri de autentificare prin SMS',
    ],
    if_compromised: [
      'Blocheaza cardul din aplicatia BT Pay',
      'Suna 0264-308 028 (Fraude BT)',
      'Schimba parola BT24',
      'Raporteaza la DNSC (1911)',
      'Depune plangere la Politie',
    ],
  },
  'CEC Bank': {
    official_domain: 'cec.ro',
    fraud_phone: '021-311 11 19',
    fraud_page: 'https://www.cec.ro/securitate',
    key_facts: [
      'CEC Bank nu solicita date confidentiale prin SMS sau email',
      'CEC Online se acceseaza exclusiv prin cecbankonline.ro',
    ],
    if_compromised: [
      'Suna 021-311 11 19 (Contact Center CEC Bank)',
      'Blocheaza cardul din CEC Online',
      'Raporteaza la DNSC (1911)',
      'Depune plangere la Politie',
    ],
  },
  'UniCredit Bank Romania': {
    official_domain: 'unicredit.ro',
    fraud_phone: '021-200 2020',
    fraud_page: 'https://www.unicredit.ro/securitate',
    key_facts: [
      'UniCredit nu solicita niciodata date de card sau parole prin telefon sau email',
      'Platile online UniCredit se fac exclusiv prin euplatesc.ro',
    ],
    if_compromised: [
      'Suna 021-200 2020 (Contact Center UniCredit)',
      'Blocheaza cardul din aplicatia UniCredit',
      'Raporteaza la DNSC (1911)',
      'Depune plangere la Politie',
    ],
  },
  'Raiffeisen': {
    official_domain: 'raiffeisen.ro',
    fraud_phone: '*7227',
    fraud_page: 'https://www.raiffeisen.ro/securitate/',
    key_facts: [
      'Raiffeisen nu solicita niciodata PIN-ul cardului sau codul CVV prin telefon sau SMS',
      'Domeniul oficial este raiffeisen.ro — verifica intotdeauna URL-ul inainte de a introduce date',
      'Raporteaza frauda la *7227 sau direct din aplicatia Smart Mobile',
      'Raiffeisen foloseste 3D Secure pentru toate tranzactiile online',
    ],
    if_compromised: ['Suna *7227', 'Raporteaza la DNSC (1911)'],
  },
  'Garanti BBVA': {
    official_domain: 'garantibbva.ro',
    fraud_phone: '0800 410 410',
    fraud_page: 'https://www.garantibbva.ro/securitate',
    key_facts: [
      'Garanti BBVA nu solicita niciodata date de card sau parole prin telefon, SMS sau email',
      'Garanti BBVA nu trimite link-uri de autentificare prin SMS',
      'Aplicatia oficiala Garanti BBVA Mobile este singura modalitate sigura de acces digital',
      'Apelurile suspecte care pretind a fi banca trebuie raportate imediat la 0800 410 410',
    ],
    if_compromised: [
      'Blocheaza cardul imediat din aplicatia Garanti BBVA Mobile',
      'Suna 0800 410 410 (linie gratuita Garanti BBVA)',
      'Schimba parola aplicatiei si PIN-ul cardului',
      'Raporteaza la DNSC (1911)',
      'Depune plangere la Politie',
    ],
  },
  'Alpha Bank': {
    official_domain: 'alphabank.ro',
    fraud_phone: '021-209 0000',
    fraud_page: 'https://www.alphabank.ro/securitate',
    key_facts: [
      'Alpha Bank nu solicita niciodata date confidentiale prin SMS, email sau telefon',
      'Alpha Bank nu trimite link-uri catre pagini de autentificare prin SMS',
      'Codul PIN si parola Alpha Web Banking nu se comunica niciodata tertilor',
      'Tranzactiile suspecte trebuie raportate imediat la Contact Center',
    ],
    if_compromised: [
      'Blocheaza cardul imediat contactand Alpha Bank',
      'Suna 021-209 0000 (Contact Center Alpha Bank)',
      'Schimba parola Alpha Web Banking',
      'Raporteaza la DNSC (1911)',
      'Depune plangere la Politie',
    ],
  },
  'Revolut Romania': {
    official_domain: 'revolut.com',
    fraud_phone: 'N/A - suport exclusiv prin chat in aplicatie',
    fraud_page: 'https://www.revolut.com/ro-RO/security',
    key_facts: [
      'Revolut nu are linie telefonica de suport — comunicarea se face exclusiv prin chat in aplicatie',
      'Revolut nu solicita niciodata parola, codul PIN sau codul de verificare prin telefon sau email',
      'Functia "Freeze card" blocheaza instantaneu cardul din aplicatie',
      'Linkurile oficiale Revolut provin exclusiv de pe domeniul revolut.com',
    ],
    if_compromised: [
      'Blocheaza cardul imediat din aplicatia Revolut (Freeze sau blocare permanenta)',
      'Contacteaza suportul Revolut exclusiv prin chat-ul din aplicatie',
      'Schimba parola contului Revolut si activeaza autentificarea in doi pasi',
      'Raporteaza la DNSC (1911)',
      'Depune plangere la Politie',
    ],
  },
};
