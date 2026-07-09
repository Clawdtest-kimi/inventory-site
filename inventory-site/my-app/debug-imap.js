const imaps = require('imap-simple');
process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';

const IMAP_CONFIG = {
  user: 'stock@packaging.team',
  password: 'Bucharest@2027',
  host: 'mail.privateemail.com',
  port: 993,
  tls: true,
  connTimeout: 30000,
  authTimeout: 30000
};

(async () => {
  const connection = await imaps.connect({ imap: IMAP_CONFIG, onerror: (err) => console.error('IMAP Error:', err.message) });
  await connection.openBox('INBOX');
  
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const dateStr = since.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/,/g, '');
  
  const searchCriteria = [['SINCE', dateStr]];
  const fetchOptions = { bodies: ['HEADER'], markSeen: false };
  
  const messages = await connection.search(searchCriteria, fetchOptions);
  console.log(`Found ${messages.length} emails from last 90 days\n`);
  
  for (const msg of messages) {
    const header = msg.parts.find(p => p.which === 'HEADER');
    if (header) {
      console.log(`  Subject: ${header.body.subject?.[0] || '(none)'}`);
      console.log(`  From: ${header.body.from?.[0] || '(none)'}`);
      console.log(`  Date: ${header.body.date?.[0] || '(none)'}`);
      console.log('');
    }
  }
  
  await connection.end();
})();