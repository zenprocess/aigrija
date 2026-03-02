export const OFFICIAL_DOMAINS = {
    banks: ['ing.ro', 'bcr.ro', 'brd.ro', 'raiffeisen.ro', 'bt.ro', 'unicredit.ro', 'cec.ro'],
    couriers: ['fancourier.ro', 'sameday.ro', 'dpd.ro', 'gls-group.eu', 'posta-romana.ro'],
    govt: ['anaf.ro', 'dnsc.ro', 'politiaromana.ro', 'cnair.ro', 'ghiseul.ro', 'roviniete.ro'],
    telecom: ['orange.ro', 'vodafone.ro', 'digi.ro'],
};
export function getAllOfficialDomains() {
    return Object.values(OFFICIAL_DOMAINS).flat();
}
