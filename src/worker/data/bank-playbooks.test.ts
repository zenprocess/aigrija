import { describe, it, expect } from 'vitest';
import { BANK_PLAYBOOKS } from './bank-playbooks';

describe('BANK_PLAYBOOKS', () => {
  it('contains all required Romanian market players', () => {
    const expectedBanks = [
      'ING Romania',
      'BCR',
      'BRD',
      'Banca Transilvania',
      'CEC Bank',
      'UniCredit Bank Romania',
      'Raiffeisen',
      'Garanti BBVA',
      'Alpha Bank',
      'Revolut Romania',
    ];
    for (const bank of expectedBanks) {
      expect(BANK_PLAYBOOKS).toHaveProperty(bank);
    }
  });

  it('each entry has required fields', () => {
    for (const [name, playbook] of Object.entries(BANK_PLAYBOOKS)) {
      expect(typeof playbook.official_domain, `${name}.official_domain`).toBe('string');
      expect(playbook.official_domain.length, `${name}.official_domain non-empty`).toBeGreaterThan(0);
      expect(typeof playbook.fraud_phone, `${name}.fraud_phone`).toBe('string');
      expect(typeof playbook.fraud_page, `${name}.fraud_page`).toBe('string');
      expect(Array.isArray(playbook.key_facts), `${name}.key_facts is array`).toBe(true);
      expect(Array.isArray(playbook.if_compromised), `${name}.if_compromised is array`).toBe(true);
    }
  });

  it('new banks have at least 3 key_facts', () => {
    const newBanks = ['Garanti BBVA', 'Alpha Bank', 'Revolut Romania'];
    for (const bank of newBanks) {
      expect(BANK_PLAYBOOKS[bank].key_facts.length, `${bank} key_facts count`).toBeGreaterThanOrEqual(3);
    }
  });

  it('new banks have at least 3 if_compromised steps', () => {
    const newBanks = ['Garanti BBVA', 'Alpha Bank', 'Revolut Romania'];
    for (const bank of newBanks) {
      expect(BANK_PLAYBOOKS[bank].if_compromised.length, `${bank} if_compromised count`).toBeGreaterThanOrEqual(3);
    }
  });

  it('Garanti BBVA has correct domain and phone', () => {
    expect(BANK_PLAYBOOKS['Garanti BBVA'].official_domain).toBe('garantibbva.ro');
    expect(BANK_PLAYBOOKS['Garanti BBVA'].fraud_phone).toBe('0800 410 410');
  });

  it('Alpha Bank has correct domain and phone', () => {
    expect(BANK_PLAYBOOKS['Alpha Bank'].official_domain).toBe('alphabank.ro');
    expect(BANK_PLAYBOOKS['Alpha Bank'].fraud_phone).toBe('021-209 0000');
  });

  it('Revolut Romania has correct domain', () => {
    expect(BANK_PLAYBOOKS['Revolut Romania'].official_domain).toBe('revolut.com');
  });
});
