# Email Setup Guide - stock@packaging.team

## Webhook URL

Your email webhook endpoint is:
```
https://my-app-brown-gamma-99.vercel.app/api/email
```

## Option 1: Mailgun (Recommended - Free tier: 5,000 emails/month)

1. Sign up at https://mailgun.com
2. Add your domain `packaging.team`
3. Create a route:
   - Expression: `match_recipient("stock@packaging.team")`
   - Action: `forward("https://my-app-brown-gamma-99.vercel.app/api/email")`
4. Verify domain DNS records

## Option 2: Forward Email (Free - simpler)

1. Go to https://forwardemail.net
2. Add domain `packaging.team`
3. Create forwarding rule:
   - From: `stock@packaging.team`
   - To: Webhook URL: `https://my-app-brown-gamma-99.vercel.app/api/email`

## Option 3: AWS SES (Almost free)

1. Verify domain in AWS SES
2. Create receipt rule:
   - Recipient: `stock@packaging.team`
   - Action: Lambda function or SNS → HTTP endpoint
   - Endpoint: `https://my-app-brown-gamma-99.vercel.app/api/email`

## Option 4: Cloudflare Email Routing (Free)

1. In Cloudflare dashboard for `packaging.team`
2. Go to Email → Email Routing
3. Create rule:
   - Custom address: `stock@packaging.team`
   - Action: Send to a Worker
4. Create Worker to POST to webhook URL

## Testing

Send a test email to `stock@packaging.team` with the stock table.

The system will:
1. Receive the email via webhook
2. Parse the stock table automatically
3. Update the inventory database

## Email Format Supported

The parser looks for:
- Subject containing "stock", "inventory", or "daily report"
- Table with columns: Width, 6.35µ, 7µ, 8µ, 9µ, 12µ, 37µ, 40µ, Total
- Rows with width values (565, 700, 735, etc.)

Works with:
- Plain text emails
- HTML emails
- Forwarded emails (.eml format)
- Quoted-printable encoding
