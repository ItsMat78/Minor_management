# Server Setup

## 1. Directories

```bash
sudo mkdir -p /var/app/uploads/{submissions,proposals,updates,avatars,imports,misc}
sudo mkdir -p /backups/mongo /backups/uploads
sudo chown -R $USER:$USER /var/app /backups
```

`.env`:
```
UPLOAD_DIR=/var/app/uploads
UPLOAD_BASE_URL=https://portal.iiitnr.ac.in
```

---

## 2. MongoDB

```bash
sudo systemctl enable mongod
sudo systemctl start mongod
sudo systemctl status mongod
```

---

## 3. PM2

```bash
npm install -g pm2
pm2 start dist/index.js --name "minor-portal"
pm2 startup   # copy and run the command it prints
pm2 save
```

Log rotation:
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## 4. Cron jobs

```bash
sudo apt install mailutils -y
```

`/etc/cron.d/minor-portal`:
```
0 2 * * * root mongodump --uri="$(grep MONGO_URI /var/app/.env | cut -d= -f2-)" --out=/backups/mongo/$(date +\%Y-\%m-\%d) && find /backups/mongo/ -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;
0 3 * * * root tar -czf /backups/uploads/$(date +\%Y-\%m-\%d).tar.gz /var/app/uploads/ && find /backups/uploads/ -name "*.tar.gz" -mtime +5 -delete
0 4 * * 0 root cd /var/app && node dist/scripts/cleanupOrphanedFiles.js >> /var/log/minor-portal-cleanup.log 2>&1
0 8 * * * root USAGE=$(df /var/app | awk 'NR==2 {gsub("%",""); print $5}'); [ "$USAGE" -gt 80 ] && echo "Disk at ${USAGE}% on $(hostname)" | mail -s "ALERT: Minor Portal Disk Usage" admin@iiitnr.ac.in
```

```bash
sudo chmod 644 /etc/cron.d/minor-portal
sudo systemctl reload cron
```

---

## 5. Cleanup script (first run)

```bash
cd /var/app
node dist/scripts/cleanupOrphanedFiles.js --dry-run
# if output looks right:
node dist/scripts/cleanupOrphanedFiles.js
```

---

## 6. Firewall

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw deny 27017
sudo ufw enable
```

---

## 7. Email (Resend)

1. Sign up at resend.com
2. Domains → Add Domain → `minor.iiitnr.ac.in`
3. Ask IT admin to add these DNS records:

| Type | Name | Value |
|---|---|---|
| TXT | `minor.iiitnr.ac.in` | `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey.minor.iiitnr.ac.in` | *(value shown in Resend dashboard)* |
| TXT | `_dmarc.minor.iiitnr.ac.in` | `v=DMARC1; p=quarantine; rua=mailto:admin@iiitnr.ac.in` |

4. API Keys → Create API Key → copy the `re_...` value
5. `.env`:
```
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=resend
EMAIL_PASS=re_xxxxxxxxxxxx
EMAIL_FROM=no-reply@minor.iiitnr.ac.in
EMAIL_REPLY_TO=btechminiproject@iiitnr.edu.in
```

Test:
```bash
cd /var/app
node -e "
const nodemailer = require('nodemailer');
require('dotenv').config();
const t = nodemailer.createTransport({
  host: process.env.EMAIL_HOST, port: +process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});
t.sendMail({ from: process.env.EMAIL_FROM, to: 'your-email@gmail.com', subject: 'Test', text: 'Works.' })
  .then(i => console.log('OK', i.messageId)).catch(console.error);
"
```
