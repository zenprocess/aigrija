// Utility to handle API calls with fallback mock data for the sandbox environment
// In a real environment, this would just be standard fetch calls.

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchCounter = async () => {
  try {
    const res = await fetch('/api/counter');
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    // API returns { total_checks } — normalize to { count } for the UI
    return { count: data.total_checks ?? data.count ?? 0 };
  } catch (error) {
    // Sandbox fallback
    await delay(500);
    return { count: 142857 };
  }
};

export const fetchAlerts = async () => {
  try {
    const res = await fetch('/api/alerts');
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (error) {
    // Sandbox fallback
    await delay(800);
    return {
      campaigns: [
        { slug: "colet-nesolicitat-posta", name: "Colet nesolicitat Poșta Română", entity: "Poșta Română", severity: "high", status: "active", description: "Mesaje text care cer plata unei taxe vamale false pentru un colet inexistent." },
        { slug: "actualizare-date-banca", name: "Actualizare date bancare", entity: "Bănci multiple", severity: "high", status: "active", description: "Emailuri ce simulează notificări bancare cerând validarea urgentă a contului." },
        { slug: "oferta-munca-whatsapp", name: "Oferte de muncă false", entity: "WhatsApp", severity: "medium", status: "active", description: "Mesaje pe WhatsApp care promit venituri mari pentru a da like-uri pe YouTube." }
      ]
    };
  }
};

export const checkContent = async (text, url) => {
  try {
    const res = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, url })
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error('Prea multe cereri. Încearcă din nou în 60 secunde.');
      throw new Error('Eroare de rețea. Verifică conexiunea.');
    }
    return await res.json();
  } catch (error) {
    // Sandbox fallback to demonstrate UI
    await delay(1500);
    
    if (error.message.includes('Prea multe')) throw error;
    
    const textLower = text.toLowerCase();
    
    // Mock logic based on input text to show different states
    if (textLower.includes('banca') || textLower.includes('cont') || textLower.includes('urgent')) {
      return {
        classification: {
          verdict: "phishing",
          confidence: 98,
          scam_type: "Furt de credențiale bancare",
          explanation: "Acest mesaj folosește tactici de urgență pentru a te determina să accesezi un link fals și să îți introduci datele bancare.",
          red_flags: ["Solicitare urgentă de acțiune", "Link către un domeniu care nu aparține instituției", "Amenințare cu blocarea contului"],
          recommended_actions: ["Nu da click pe niciun link", "Nu oferi date personale sau bancare", "Contactează banca folosind numărul de pe spatele cardului"]
        },
        url_analysis: url ? { domain: new URL(url.startsWith('http') ? url : `https://${url}`).hostname, risk_score: 95, is_suspicious: true, flags: ["Domeniu înregistrat recent", "Certificat SSL gratuit", "Nume similar cu brand oficial"] } : null,
        matched_campaigns: [{ slug: "actualizare-date-banca", name: "Actualizare date bancare", score: 92 }],
        bank_playbook: { bank_name: "Banca Transilvania (Exemplu)", official_domain: "bancatransilvania.ro", fraud_phone: "0264 308 028", if_compromised: ["Blochează cardul din aplicație", "Sună imediat la numărul de urgență", "Schimbă parola de internet banking"] }
      };
    } else if (textLower.includes('colet') || textLower.includes('posta') || textLower.includes('livrare')) {
      return {
        classification: {
          verdict: "suspicious",
          confidence: 75,
          scam_type: "Fraudă cu taxe de livrare",
          explanation: "Mesajul pretinde că ai un colet în așteptare și cere o mică taxă. Este o metodă comună de a fura datele cardului.",
          red_flags: ["Cerere de plată pentru un colet neașteptat", "Link scurtat sau obscur"],
          recommended_actions: ["Verifică statusul comenzilor tale reale pe site-urile oficiale", "Ignoră mesajul dacă nu aștepți nimic"]
        },
        url_analysis: null,
        matched_campaigns: [{ slug: "colet-nesolicitat-posta", name: "Colet nesolicitat Poșta Română", score: 85 }],
        bank_playbook: null
      };
    } else {
      return {
        classification: {
          verdict: "likely_safe",
          confidence: 88,
          scam_type: "Niciunul detectat",
          explanation: "Nu am detectat tipare cunoscute de fraudă sau limbaj manipulativ în acest mesaj. Totuși, rămâi vigilent.",
          red_flags: [],
          recommended_actions: ["Dacă expeditorul este necunoscut, tratează mesajul cu prudență", "Nu descărca atașamente neașteptate"]
        },
        url_analysis: url ? { domain: new URL(url.startsWith('http') ? url : `https://${url}`).hostname, risk_score: 10, is_suspicious: false, flags: ["Domeniu cu reputație bună"] } : null,
        matched_campaigns: [],
        bank_playbook: null
      };
    }
  }
};
export const checkImage = async (imageFile, textContext) => {
  const formData = new FormData();
  formData.append('image', imageFile);
  if (textContext) formData.append('text', textContext);

  const res = await fetch('/api/check/image', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Prea multe cereri. Încearcă din nou în 60 secunde.');
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || 'Eroare la analiza imaginii.');
  }
  return res.json();
};
