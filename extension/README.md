# ai-grija.ro Browser Extension

Verifică mesaje și link-uri suspecte direct din browser, cu un click dreapta.

## Instalare (modul dezvoltator)

1. Clonează sau descarcă acest repository.
2. Deschide Chrome și navighează la `chrome://extensions`.
3. Activează **"Modul pentru dezvoltatori"** (Developer mode) din colțul din dreapta sus.
4. Apasă **"Încarcă extensia neîmpachetată"** (Load unpacked).
5. Selectează directorul `extension/` din acest repository.
6. Extensia apare în bara Chrome cu iconița ai-grija.ro.

### Configurare icoane

Inainte de a incarca extensia, adaugă iconițele în `extension/icons/`:

```bash
# Descarcă iconița sursă
curl -o extension/icons/source.png https://ai-grija.ro/favicon-96x96.png

# Redimensionează (necesită ImageMagick)
convert extension/icons/source.png -resize 16x16  extension/icons/icon-16.png
convert extension/icons/source.png -resize 48x48  extension/icons/icon-48.png
convert extension/icons/source.png -resize 128x128 extension/icons/icon-128.png
```

## Utilizare

### Verificare text selectat
1. Selectează orice text suspect pe o pagină web.
2. Click dreapta → **"Verifică cu ai-grija.ro"**.
3. Rezultatul apare în popup-ul extensiei.

### Verificare link
1. Hover pe orice link suspect.
2. Click dreapta pe link → **"Verifică link cu ai-grija.ro"**.
3. Rezultatul apare în popup-ul extensiei.

### Popup direct
- Click pe iconița extensiei din bara Chrome pentru a vedea ultimul rezultat.

## Interpretarea rezultatelor

| Culoare | Verdict | Semnificație |
|---------|---------|--------------|
| Roșu | PHISHING | Pericol ridicat — nu accesa |
| Galben | SUSPECT | Fii precaut — verifică sursa |
| Verde | SIGUR | Nicio amenințare detectată |

## Build pentru distribuție

```bash
npm run ext:pack
```

Arhiva `dist/ai-grija-extension.zip` poate fi trimisă la Chrome Web Store.

## Chrome Web Store — checklist pentru publicare

- [ ] Icoane finalizate (16px, 48px, 128px, 1280x800 screenshot)
- [ ] Descriere completă în română și engleză
- [ ] Privacy policy URL: `https://ai-grija.ro/politica-confidentialitate`
- [ ] Justificare permisiuni: `contextMenus`, `activeTab`, `storage`
- [ ] Host permission justificare: `https://ai-grija.ro/*` — API call
- [ ] Testat pe Chrome stabil + Edge
- [ ] Fără cod obfuscat
- [ ] Versiune incrementată în `manifest.json`

## Structura fișierelor

```
extension/
├── manifest.json      # Manifest V3
├── background.js      # Service worker — context menu + API calls
├── popup.html         # UI popup
├── popup.css          # Stiluri popup
├── popup.js           # Logica popup
├── content.js         # Tooltip inline în pagină
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

## Screenshots

> TODO: Adaugă screenshot-uri înainte de publicarea pe Chrome Web Store.

Plasează imaginile în `extension/screenshots/`:
- `screenshot-context-menu.png` — meniu click dreapta
- `screenshot-phishing-result.png` — rezultat phishing
- `screenshot-safe-result.png` — rezultat sigur
