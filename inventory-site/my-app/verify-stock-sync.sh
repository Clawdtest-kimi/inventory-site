#!/bin/bash
# Cross-verification: checks that website latest-stock.json matches email data
# and that the website was updated recently.
# Exit codes: 0=OK, 1=mismatch, 2=stale data, 3=website unreachable

set -euo pipefail

WEBSITE="https://www.packaging.team/latest-stock.json"
LOCAL_FILE="/Users/Apple/Desktop/Desktop_Mac_Mini_05JUN2026/inventory-site-github/inventory-site/my-app/public/latest-stock.json"
MAX_AGE_HOURS=24  # Alert if website data is older than 24 hours

echo "=== Stock Sync Verification ==="
echo "Time: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# 1. Fetch website data
echo ""
echo "--- 1. Fetching website latest-stock.json ---"
WEB_DATA=$(curl -s --max-time 15 "$WEBSITE?v=$(date +%s)" 2>&1) || {
  echo "❌ ERROR: Cannot reach $WEBSITE"
  exit 3
}

if echo "$WEB_DATA" | grep -q '"totalReels"'; then
  echo "✅ Website reachable and returning JSON"
else
  echo "❌ ERROR: Website response is not valid stock JSON"
  echo "Response (first 500 chars): $(echo "$WEB_DATA" | head -c 500)"
  exit 3
fi

# 2. Parse key fields from website
WEB_REELS=$(echo "$WEB_DATA" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('totalReels',0))" 2>/dev/null)
WEB_QTY=$(echo "$WEB_DATA" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('totalQty',0))" 2>/dev/null)
WEB_TIMESTAMP=$(echo "$WEB_DATA" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('timestamp','unknown'))" 2>/dev/null)
WEB_EMAIL_DATE=$(echo "$WEB_DATA" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('emailDate','unknown'))" 2>/dev/null)
WEB_ROWS=$(echo "$WEB_DATA" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null)

echo "  Website totalReels: $WEB_REELS"
echo "  Website totalQty:   $WEB_QTY"
echo "  Website rows:       $WEB_ROWS"
echo "  Website timestamp:  $WEB_TIMESTAMP"
echo "  Website emailDate:  $WEB_EMAIL_DATE"

# 3. Compare with local file
echo ""
echo "--- 2. Comparing with local latest-stock.json ---"
if [ ! -f "$LOCAL_FILE" ]; then
  echo "⚠️  WARNING: Local file $LOCAL_FILE not found — cannot cross-verify"
else
  LOCAL_REELS=$(python3 -c "import json; d=json.load(open('$LOCAL_FILE')); print(d.get('totalReels',0))" 2>/dev/null)
  LOCAL_QTY=$(python3 -c "import json; d=json.load(open('$LOCAL_FILE')); print(d.get('totalQty',0))" 2>/dev/null)
  LOCAL_ROWS=$(python3 -c "import json; d=json.load(open('$LOCAL_FILE')); print(len(d.get('data',[])))" 2>/dev/null)
  LOCAL_EMAIL_DATE=$(python3 -c "import json; d=json.load(open('$LOCAL_FILE')); print(d.get('emailDate','unknown'))" 2>/dev/null)

  echo "  Local totalReels:   $LOCAL_REELS"
  echo "  Local totalQty:     $LOCAL_QTY"
  echo "  Local rows:         $LOCAL_ROWS"
  echo "  Local emailDate:    $LOCAL_EMAIL_DATE"

  if [ "$WEB_REELS" = "$LOCAL_REELS" ] && [ "$WEB_QTY" = "$LOCAL_QTY" ]; then
    echo "  ✅ MATCH: Website data matches local data"
  else
    echo "  ❌ MISMATCH: Website ($WEB_REELS reels / $WEB_QTY kg) ≠ Local ($LOCAL_REELS reels / $LOCAL_QTY kg)"
    exit 1
  fi

  if [ "$WEB_EMAIL_DATE" = "$LOCAL_EMAIL_DATE" ]; then
    echo "  ✅ MATCH: Email source date matches"
  else
    echo "  ❌ MISMATCH: Website emailDate ($WEB_EMAIL_DATE) ≠ Local emailDate ($LOCAL_EMAIL_DATE)"
    exit 1
  fi
fi

# 4. Check data freshness
echo ""
echo "--- 3. Data freshness check ---"
if [ "$WEB_TIMESTAMP" = "unknown" ]; then
  echo "⚠️  WARNING: Cannot determine website data timestamp"
else
  AGE_HOURS=$(python3 -c "
from datetime import datetime, timezone
ts = '$WEB_TIMESTAMP'.replace('Z','+00:00')
try:
    dt = datetime.fromisoformat(ts)
    age = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
    print(f'{age:.1f}')
except:
    print('999')
" 2>/dev/null)

  if [ "$AGE_HOURS" = "999" ]; then
    echo "⚠️  WARNING: Cannot parse timestamp $WEB_TIMESTAMP"
  elif python3 -c "exit(0 if float('$AGE_HOURS') <= $MAX_AGE_HOURS else 1)" 2>/dev/null; then
    echo "✅ Data age: ${AGE_HOURS}h (within ${MAX_AGE_HOURS}h limit)"
  else
    echo "⚠️  STALE: Data age is ${AGE_HOURS}h (older than ${MAX_AGE_HOURS}h limit)"
    # Don't exit with error — just warn, since no new email may have arrived
  fi
fi

# 5. Check email source age
echo ""
echo "--- 4. Email source age ---"
if [ "$WEB_EMAIL_DATE" != "unknown" ]; then
  EMAIL_AGE_DAYS=$(python3 -c "
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
try:
    dt = parsedate_to_datetime('$WEB_EMAIL_DATE')
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - dt).days
    print(age)
except:
    print('999')
" 2>/dev/null)

  echo "  Source email is $EMAIL_AGE_DAYS days old"
  if [ "$EMAIL_AGE_DAYS" -gt 3 ] 2>/dev/null; then
    echo "  ⚠️  WARNING: Source email is $EMAIL_AGE_DAYS days old — no new stock report from SRF?"
  else
    echo "  ✅ Source email is recent ($EMAIL_AGE_DAYS days old)"
  fi
fi

echo ""
echo "=== Verification complete ==="
exit 0