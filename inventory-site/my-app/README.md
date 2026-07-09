# Inventory Management System

A Next.js-based inventory management system styled after TPL Lager with CSV upload capabilities.

## Features

- 📊 Stock inventory table by width and micron thickness
- 🔐 Master account with CSV upload functionality
- 🎨 Clean, industrial design matching TPL aesthetic
- 📱 Responsive layout
- ⚡ Vercel-ready deployment

## Login Credentials

- **Username:** `Admin`
- **Password:** `Bucharest@2026`

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## Production URL

**Live Site:** https://inventory-site-v2.vercel.app

## Deploy to Vercel

### Option 1: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### Option 2: GitHub Integration

1. Push this project to a GitHub repository
2. Import the repo on [Vercel Dashboard](https://vercel.com/dashboard)
3. Configure environment variables:
   - `NEXTAUTH_URL`: Your production URL (e.g., `https://your-app.vercel.app`)
   - `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
4. Deploy!

## CSV Format

The system expects CSV files with this structure:

```csv
Width (mm),6.35µ,,7µ,,8µ,,9µ,,12µ,,37µ,,40µ,,Total,,
,Reels,Qty,Reels,Qty,Reels,Qty,Reels,Qty,Reels,Qty,Reels,Qty,Reels,Qty,Reels,Qty
565,,,1,266,,,,,,,,,,,1,266
700,,,,,,,44,13381,,,20,8278,,,64,21659
```

## Project Structure

```
my-app/
├── app/
│   ├── api/auth/[...nextauth]/   # Authentication
│   ├── components/               # Shared components
│   ├── login/                    # Login page
│   ├── master/                   # CSV upload page
│   ├── page/                     # Home with inventory table
│   ├── layout.tsx               # Root layout
│   └── providers.tsx            # Session provider
├── components/ui/               # shadcn/ui components
├── lib/
│   ├── csv-parser.ts           # CSV parsing logic
│   └── types.ts                # TypeScript types
├── public/
│   └── logo.png                # Your company logo
└── ...config files
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXTAUTH_URL` | Your app URL (required for production) |
| `NEXTAUTH_SECRET` | Random secret for JWT encryption |

## Notes

- Data is stored in browser localStorage (demo purposes)
- For production, connect to a real database
- CSV upload overwrites existing data
Build timestamp Mon May 25 15:39:09 EEST 2026
