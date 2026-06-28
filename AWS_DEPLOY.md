# Deploy EvalDesk to AWS (EC2)

Cheapest path: a single Ubuntu EC2 instance running `docker compose` (app + worker + Postgres). Works on Free Tier or against credits.

## 1. Launch the instance
1. EC2 → **Launch instances**.
2. **AMI:** Ubuntu Server 22.04 LTS (x86 or ARM — both work).
3. **Type:** `t3.micro` (Free Tier, 1 GB) or `t3.small` (2 GB — better; covered by your $98 credits).
4. **Network:** default VPC, **public subnet**, **auto-assign public IP = Enable**.
   - ⚠️ **Do NOT add a NAT Gateway** — it costs ~$32/mo. A public subnet needs none.
5. **Storage:** 20 GB gp3.
6. **Key pair:** create one, save the `.pem`.
7. **Security group:** inbound rules —
   - SSH (22) from **My IP** (not 0.0.0.0/0)
   - HTTP (80) from 0.0.0.0/0
   - HTTPS (443) from 0.0.0.0/0
8. Launch. Copy the **Public IPv4 address**.

## 2. SSH in + install Docker
```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<PUBLIC_IP>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
```

## 3. Configure + launch
```bash
git clone https://github.com/ramandagar/EvalDesk.git
cd EvalDesk
cp .env.example .env
# edit .env — set POSTGRES_PASSWORD, DATABASE_URL, EVALDESK_ENCRYPTION_KEYS,
# EVALDESK_ACTIVE_KEY_ID, DEEPSEEK_API_KEY
nano .env
```
Generate the encryption key on the VM: `openssl rand -base64 32` → paste into `EVALDESK_ENCRYPTION_KEYS=dev1:<key>`.

```bash
docker compose up -d --build
docker compose logs -f evaldesk      # watch boot, Ctrl-C to exit
curl http://localhost:3000/api/health  # → {"status":"ok",...}
```

## 4. HTTPS (optional, via Cloudflare)
Point `app.yourdomain.com` A record → EC2 public IP (proxied). Cloudflare SSL = Full. Done.

## Cost guardrails
- **No NAT Gateway** (~$32/mo trap) — public subnet only.
- `t3.micro` = free 12 mo (new account); `t3.small` ≈ $15/mo, your $98 credits cover ~6 months.
- Egress: first 100 GB/mo free.
- Keep an eye on Billing → **Budgets** → set a $10 alert.
