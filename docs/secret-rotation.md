# Secret Rotation Procedures

This document describes the procedures for rotating all secrets used by the SParking application. Regular rotation reduces the blast radius of compromised credentials.

---

## Table of Contents

1. [Rotation Schedule](#rotation-schedule)
2. [JWT_SECRET Rotation](#jwt_secret-rotation)
3. [ENCRYPTION_KEY Rotation](#encryption_key-rotation)
4. [Database Password Rotation](#database-password-rotation)
5. [API Key Rotation: Razorpay](#api-key-rotation-razorpay)
6. [API Key Rotation: Stripe](#api-key-rotation-stripe)
7. [API Key Rotation: SendGrid](#api-key-rotation-sendgrid)
8. [API Key Rotation: Twilio / MSG91](#api-key-rotation-twilio--msg91)
9. [Azure AD Client Secret Rotation](#azure-ad-client-secret-rotation)
10. [DETECTION_API_KEY Rotation](#detection_api_key-rotation)
11. [Emergency Rotation Checklist](#emergency-rotation-checklist)

---

## Rotation Schedule

| Secret                  | Recommended Frequency | Impact of Rotation          |
|-------------------------|-----------------------|-----------------------------|
| JWT_SECRET              | Every 90 days         | Invalidates all sessions    |
| ENCRYPTION_KEY          | Every 180 days        | Requires data re-encryption |
| Database password       | Every 90 days         | Brief downtime              |
| Razorpay keys           | Every 180 days        | Webhook re-registration     |
| Stripe keys             | Every 180 days        | Webhook re-registration     |
| SendGrid API key        | Every 90 days         | None (stateless)            |
| Twilio auth token       | Every 90 days         | None (stateless)            |
| Azure AD client secret  | Before expiry         | None if done proactively    |
| DETECTION_API_KEY       | Every 90 days         | Update all pipeline clients |
| CRON_SECRET             | Every 90 days         | Update cron job configs     |

---

## JWT_SECRET Rotation

The JWT_SECRET is used to sign authentication tokens. Rotating it invalidates all existing sessions.

### Procedure

**Step 1: Generate a new secret**

```bash
NEW_JWT_SECRET=$(openssl rand -base64 32)
echo "New JWT_SECRET: $NEW_JWT_SECRET"
```

**Step 2: Plan for session invalidation**

All users will be logged out when the secret changes. Schedule rotation during low-traffic hours and communicate the maintenance window.

**Step 3: Update the environment variable**

For Docker Compose deployments:
```bash
# Update .env file
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$NEW_JWT_SECRET|" .env
```

For Vercel deployments:
```bash
vercel env rm JWT_SECRET production
echo "$NEW_JWT_SECRET" | vercel env add JWT_SECRET production
```

For Neon/cloud environments, update via the hosting platform's secret management.

**Step 4: Restart the application**

```bash
# Docker
docker compose restart app

# Vercel (triggers redeploy)
vercel --prod
```

**Step 5: Verify**

```bash
# Confirm the old token is rejected
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer OLD_TOKEN_HERE" \
  http://localhost:3000/api/auth/me
# Expected: 401

# Confirm new login works
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sparking.app","password":"testpassword"}' \
  | jq .token
# Expected: a new valid token
```

**Step 6: Record the rotation**

Log the rotation date (not the secret value) in your team's secret management tool or operations log.

---

## ENCRYPTION_KEY Rotation

The ENCRYPTION_KEY encrypts sensitive data at rest (camera credentials, webhook secrets, etc.). Rotation requires re-encrypting all existing data.

### Procedure

**Step 1: Generate a new key**

```bash
NEW_ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "New ENCRYPTION_KEY: $NEW_ENCRYPTION_KEY"
```

**Step 2: Support dual keys temporarily**

Set both old and new keys in the environment to allow decryption of old data and encryption with the new key:

```bash
# In .env
ENCRYPTION_KEY=$NEW_ENCRYPTION_KEY
ENCRYPTION_KEY_OLD=$OLD_ENCRYPTION_KEY
```

**Step 3: Run the re-encryption migration**

Create and run a script that decrypts all encrypted fields with the old key and re-encrypts with the new key:

```bash
npx ts-node scripts/rotate-encryption-key.ts
```

The script should:
1. Read all rows with encrypted fields (camera credentials, organization secrets)
2. Decrypt each value using `ENCRYPTION_KEY_OLD`
3. Re-encrypt using `ENCRYPTION_KEY`
4. Update the row in a transaction

**Step 4: Remove the old key**

After verifying all data is re-encrypted:

```bash
# Remove ENCRYPTION_KEY_OLD from .env
sed -i '/^ENCRYPTION_KEY_OLD=/d' .env
```

**Step 5: Restart and verify**

```bash
docker compose restart app

# Verify encrypted data is accessible
curl -s http://localhost:3000/api/cameras \
  -H "Authorization: Bearer $TOKEN" | jq '.[0].status'
```

---

## Database Password Rotation

### Procedure

**Step 1: Generate a new password**

```bash
NEW_DB_PASSWORD=$(openssl rand -base64 32 | tr -d '=+/')
echo "New password: $NEW_DB_PASSWORD"
```

**Step 2: Update the password in PostgreSQL**

```bash
# Connect as superuser
docker exec -it sparking-db psql -U postgres -c \
  "ALTER USER sparking WITH PASSWORD '$NEW_DB_PASSWORD';"
```

**Step 3: Update all connection strings**

Update `.env`:
```bash
DATABASE_URL="postgresql://sparking:$NEW_DB_PASSWORD@postgres:5432/sparking"
```

Also update:
- `docker-compose.yml` (POSTGRES_PASSWORD variable)
- Any backup scripts that use database credentials
- CI/CD pipeline secrets
- Vercel environment variables (if applicable)

**Step 4: Restart services that connect to the database**

```bash
docker compose restart app ai-pipeline mqtt-translator feature-matching
```

**Step 5: Verify connectivity**

```bash
docker exec sparking-app npx prisma db execute --stdin <<< "SELECT 1;"

# Check application health
curl -f http://localhost:3000/api/health
```

### Neon Database Password Rotation

For the Neon cloud database:

```bash
# Rotate via Neon CLI
neonctl roles set-password --project-id your-project-id --branch main --role neondb_owner

# Update DATABASE_URL in Vercel
vercel env rm DATABASE_URL production
echo "postgresql://neondb_owner:NEW_PASSWORD@ep-your-endpoint.neon.tech/neondb?sslmode=require" \
  | vercel env add DATABASE_URL production

# Redeploy
vercel --prod
```

---

## API Key Rotation: Razorpay

### Procedure

**Step 1: Generate new keys in the Razorpay Dashboard**

1. Log in to https://dashboard.razorpay.com
2. Go to Settings > API Keys
3. Generate a new API key pair
4. Save both the Key ID and Key Secret securely

**Step 2: Update environment variables**

```bash
# In .env
RAZORPAY_KEY_ID=rzp_live_NEW_KEY_ID
RAZORPAY_KEY_SECRET=NEW_KEY_SECRET
```

**Step 3: Update webhook secret**

1. In Razorpay Dashboard, go to Settings > Webhooks
2. Update or recreate the webhook with the existing endpoint URL
3. Copy the new webhook secret

```bash
RAZORPAY_WEBHOOK_SECRET=NEW_WEBHOOK_SECRET
```

**Step 4: Restart and verify**

```bash
docker compose restart app

# Verify payment creation works
curl -s http://localhost:3000/api/payments/create-order \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":100}' | jq .status
```

**Step 5: Deactivate old keys in the Razorpay Dashboard**

---

## API Key Rotation: Stripe

### Procedure

**Step 1: Roll the API key in Stripe Dashboard**

1. Log in to https://dashboard.stripe.com
2. Go to Developers > API keys
3. Click "Roll key" on the secret key
4. Set an expiration for the old key (e.g., 24 hours) to allow graceful transition

**Step 2: Update environment variables**

```bash
STRIPE_SECRET_KEY=sk_live_NEW_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_NEW_KEY
```

**Step 3: Update webhook signing secret**

1. Go to Developers > Webhooks
2. Click on your endpoint
3. Reveal the signing secret (it may change if you recreate the endpoint)

```bash
STRIPE_WEBHOOK_SECRET=whsec_NEW_SECRET
```

**Step 4: Restart, rebuild, and verify**

```bash
# Rebuild needed because NEXT_PUBLIC_ vars are baked into the client bundle
docker compose up --build app -d
```

---

## API Key Rotation: SendGrid

### Procedure

**Step 1: Create a new API key**

1. Log in to https://app.sendgrid.com
2. Go to Settings > API Keys
3. Create a new API key with the same permissions (Mail Send)
4. Copy the key immediately (it is only shown once)

**Step 2: Update environment variable**

```bash
SENDGRID_API_KEY=SG.NEW_KEY_VALUE
```

**Step 3: Restart and verify**

```bash
docker compose restart app

# Trigger a test email (e.g., password reset for a test account)
curl -s -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@staging.sparking.local"}'
```

**Step 4: Delete the old API key in the SendGrid dashboard**

---

## API Key Rotation: Twilio / MSG91

### Twilio

**Step 1:** Go to https://console.twilio.com > Account > API keys and tokens

**Step 2:** Rotate the Auth Token by clicking "Rotate token"

**Step 3:** Update the environment variable:
```bash
TWILIO_AUTH_TOKEN=new_auth_token
```

**Step 4:** Restart services and verify SMS delivery.

### MSG91

**Step 1:** Log in to https://control.msg91.com

**Step 2:** Go to API Keys and generate a new one

**Step 3:** Update the environment variable:
```bash
MSG91_AUTH_KEY=new_auth_key
```

**Step 4:** Deactivate the old key in the MSG91 dashboard.

---

## Azure AD Client Secret Rotation

Azure AD client secrets have expiration dates. Rotate before expiry to avoid Microsoft SSO authentication outages.

The client secret is used in the server-side OAuth2 + PKCE token exchange (in `src/app/api/auth/microsoft/callback/route.ts`). The redirect URI must be registered as **"Web"** type (not "SPA") in Azure AD.

### Procedure

**Step 1: Create a new client secret**

1. Go to https://portal.azure.com
2. Navigate to Azure Active Directory > App registrations > SParking
3. Go to Certificates & secrets > Client secrets
4. Click "New client secret"
5. Set a description (e.g., "Rotated 2026-02-22") and expiration (recommended: 12 months)
6. Copy the secret value immediately (it is only shown once)

**Step 2: Update environment variable**

Update `AZURE_AD_CLIENT_SECRET` in your Azure App Service Configuration (Settings > Environment variables):

```bash
AZURE_AD_CLIENT_SECRET=NEW_CLIENT_SECRET_VALUE
```

Note: `NEXT_PUBLIC_AZURE_AD_CLIENT_ID` and `NEXT_PUBLIC_AZURE_AD_TENANT_ID` do not change during secret rotation.

**Step 3: Restart and verify**

```bash
# For Azure App Service: restart via Azure Portal or CLI
az webapp restart --name your-app-name --resource-group your-rg

# For Docker deployments:
docker compose restart app

# Test: navigate to your app's login page and click "Sign in with Microsoft"
# Verify you can complete the full login flow through to the dashboard
```

**Step 4: Delete the old client secret**

Go back to Azure Portal > Certificates & secrets and delete the expired/old secret.

**Step 5: Update the rotation calendar**

Set a reminder for 30 days before the new secret's expiration date.

---

## DETECTION_API_KEY Rotation

The DETECTION_API_KEY authenticates AI pipeline services when sending detection events to the SParking API.

### Procedure

**Step 1: Generate a new key**

```bash
NEW_DETECTION_KEY=$(openssl rand -hex 32)
echo "New DETECTION_API_KEY: $NEW_DETECTION_KEY"
```

**Step 2: Update environment variables**

The key must be updated in the app AND all pipeline services:

```bash
# In .env (used by app, node-red, mqtt-translator, feature-matching)
DETECTION_API_KEY=$NEW_DETECTION_KEY
```

**Step 3: Restart all affected services**

```bash
docker compose restart app node-red mqtt-translator feature-matching
```

**Step 4: Verify pipeline connectivity**

```bash
# Check that detection events are still being received
curl -s http://localhost:3000/api/health | jq .
docker logs sparking-mqtt-translator --tail 20
```

---

## Emergency Rotation Checklist

Use this checklist when a secret is known or suspected to be compromised.

### Immediate Actions (within 15 minutes)

- [ ] **Identify** which secret(s) are compromised
- [ ] **Generate** new secrets immediately:
  ```bash
  openssl rand -base64 32  # for keys/passwords
  openssl rand -hex 32     # for API keys
  ```
- [ ] **Revoke** the compromised secret at the source (API dashboard, database, Azure portal)
- [ ] **Update** the environment variables in all deployment targets
- [ ] **Restart** all affected services
- [ ] **Verify** the application is functional with the new secrets

### Follow-Up Actions (within 1 hour)

- [ ] **Audit** access logs for unauthorized use of the compromised secret
  - Check application logs for unusual API calls
  - Check database logs for unauthorized queries
  - Check payment gateway dashboards for unauthorized transactions
- [ ] **Notify** the security team and relevant stakeholders
- [ ] **Document** the incident:
  - What was compromised
  - How it was discovered
  - When the rotation was completed
  - What access (if any) occurred during the exposure window

### If JWT_SECRET is Compromised

- [ ] Rotate immediately (all sessions will be invalidated)
- [ ] Review user accounts for unauthorized access
- [ ] Check for privilege escalation attempts
- [ ] Force password reset for any accounts with suspicious activity

### If DATABASE Password is Compromised

- [ ] Rotate the password immediately
- [ ] Review `pg_stat_activity` for active unauthorized connections:
  ```sql
  SELECT pid, usename, client_addr, state, query
  FROM pg_stat_activity
  WHERE usename = 'sparking';
  ```
- [ ] Terminate unauthorized connections:
  ```sql
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE usename = 'sparking' AND client_addr NOT IN ('trusted_ip_1', 'trusted_ip_2');
  ```
- [ ] Audit for data exfiltration (check `pg_stat_user_tables` for unusual sequential scans)
- [ ] Consider a full database audit if the exposure window is unknown

### If ENCRYPTION_KEY is Compromised

- [ ] Rotate the key using the dual-key procedure above
- [ ] Assume all encrypted data (camera credentials, stored secrets) is compromised
- [ ] Rotate all credentials that were protected by the encryption key
- [ ] Notify affected third parties (camera vendors, etc.)

### If Payment Gateway Keys are Compromised

- [ ] Immediately deactivate the compromised keys in the provider dashboard
- [ ] Generate new keys and update the application
- [ ] Review recent transactions for unauthorized charges
- [ ] Contact the payment provider's security team
- [ ] Notify affected customers if unauthorized transactions occurred

### Post-Incident

- [ ] Conduct a root cause analysis
- [ ] Update secret storage practices if needed (consider using a secrets manager such as HashiCorp Vault, AWS Secrets Manager, or Azure Key Vault)
- [ ] Review access controls and reduce the blast radius
- [ ] Update this rotation procedure if gaps were identified
