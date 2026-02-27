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
  'Raiffeisen': {
    official_domain: 'raiffeisen.ro',
    fraud_phone: '*7227',
    fraud_page: 'https://www.raiffeisen.ro/securitate/',
    key_facts: [],
    if_compromised: ['Suna *7227', 'Raporteaza la DNSC (1911)'],
  },
};
