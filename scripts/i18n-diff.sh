#\!/usr/bin/env bash
# Compare i18n keys: ro.json (reference) vs other languages
I18N_DIR="src/ui/src/i18n"
REF="$I18N_DIR/ro.json"
LANGS="bg hu uk"

if [ \! -f "$REF" ]; then
  echo "Reference file not found: $REF"
  exit 1
fi

REF_KEYS=$(jq -r 'paths(scalars) | join(".")' "$REF" | sort)

for lang in $LANGS; do
  FILE="$I18N_DIR/$lang.json"
  if [ \! -f "$FILE" ]; then
    echo "[$lang] File missing: $FILE"
    continue
  fi
  LANG_KEYS=$(jq -r 'paths(scalars) | join(".")' "$FILE" | sort)
  MISSING=$(comm -23 <(echo "$REF_KEYS") <(echo "$LANG_KEYS"))
  if [ -z "$MISSING" ]; then
    echo "[$lang] OK -- no missing keys"
  else
    echo "[$lang] Missing keys:"
    echo "$MISSING" | sed 's/^/  /'
  fi
done
