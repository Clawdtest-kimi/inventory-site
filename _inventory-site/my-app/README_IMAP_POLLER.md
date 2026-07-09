# IMAP Email Poller Documentation

## Overview

The IMAP Email Poller automatically checks the `stock@packaging.team` email inbox for new stock reports and updates the inventory website at [www.packaging.team](https://www.packaging.team).

## How It Works

1. **Polls every 15 minutes** via OpenClaw cron job
2. **Connects to Namecheap Private Email** via IMAP
3. **Parses HTML emails** containing stock tables
4. **Posts data to API** endpoint
5. **Auto-commits to GitHub** for backup

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
IMAP_USER=stock@packaging.team
IMAP_PASSWORD=your_password_here
```

Or set environment variables:

```bash
export IMAP_USER="stock@packaging.team"
export IMAP_PASSWORD="your_password_here"
```

### Email Settings (Namecheap Private Email)

```javascript
const IMAP_CONFIG = {
  user: process.env.IMAP_USER,
  password: process.env.IMAP_PASSWORD,
  host: 'mail.privateemail.com',
  port: 993,
  tls: true,
  connTimeout: 30000,
  authTimeout: 30000
};
```

### API Endpoint

```javascript
const VERCEL_API = 'https://www.packaging.team/api/email';
```

## File Structure

```
_inventory-site/my-app/
├── email-poller.js          # Main poller script
├── data/
│   └── latest-stock.json    # Backup of latest data
└── README_IMAP_POLLER.md    # This documentation
```

## Dependencies

```bash
npm install imap-simple node-fetch
```

## Usage

### Manual Run

```bash
cd _inventory-site/my-app
node email-poller.js
```

### Automated (via OpenClaw Cron)

```bash
# Check cron status
openclaw cron list

# Job ID: dce2fe01-fd60-4120-93f0-44f6934ec79a
# Schedule: */15 * * * * (every 15 minutes)
```

## Email Parsing

### Supported Formats

- **HTML tables** with `<tbody>` tags
- **Base64 encoded** emails (auto-decoded)
- **Plain text tables** with `|` separators

### Data Structure

Parsed data includes:
- Width (mm)
- Reel counts per thickness (6.35µ, 7µ, 8µ, 9µ, 12µ, 37µ, 40µ)
- Quantities per thickness
- Total reels and quantity

Example output:
```json
{
  "width": 920,
  "totalReels": 2,
  "totalQty": 1208,
  "reels9": 2,
  "qty9": 1208
}
```

## Validation

The parser validates:
- Known width values (565-1445mm)
- Minimum 5 rows of data
- Correct column mapping per width
- Total reel calculations

## GitHub Integration

After successful parsing:
1. Saves to `data/latest-stock.json`
2. Copies to repo data directory
3. Auto-commits with timestamp
4. Pushes to GitHub

## Troubleshooting

### Check Email Connection
```bash
# After setting IMAP_PASSWORD environment variable
node -e "require('imap-simple').connect({imap:{user:'stock@packaging.team',password:process.env.IMAP_PASSWORD,host:'mail.privateemail.com',port:993,tls:true}}).then(c=>{console.log('✅ Connected');c.end()})"
```

### Debug Email Content
```bash
node debug-email.js
```

### Check Cron Runs
```bash
openclaw cron runs --limit 10
```

## Security Notes

- **Never commit passwords to GitHub**
- Use environment variables or `.env` files (add to `.gitignore`)
- Consider using a password manager for secure storage
- Rotate passwords regularly
- Use app-specific passwords if available

## License

Same as main project (AGPL-3.0)
