# Deploying EvalDesk

EvalDesk ships as a single Docker image: **Next.js app + in-process worker + Postgres**, via `docker compose`. This guide covers **Oracle Cloud Always Free (ARM)** — the $0/mo option — with a **Hetzner** fallback.

> **TL;DR for the impatient:** spin up an Ubuntu VM → install Docker → `git clone` → `cp .env.example .env` → set the 3 required secrets → `docker compose up -d --build` → point a domain at it. ~15 minutes.

---

## Architecture of a deployment

```
                    ┌───────────────────────────────────────┐
   Internet ───────▶│  Cloudflare (free)  — HTTPS, DNS      │
                    └───────────────────┬───────────────────┘
                                        ▼
                    ┌───────────────────────────────────────┐
                    │  Ubuntu VM (Oracle ARM / Hetzner)      │
                    │  ┌─────────────┐   ┌────────────────┐ │
                    │  │ Caddy :80/:443│─▶│ evaldesk :3000 │ │  ← Next.js app
                    │  │ (auto-TLS)  │   │ + in-proc worker│ │     + worker
                    │  └─────────────┘   └───────┬────────┘ │
                    │                            ▼          │
                    │                    ┌────────────────┐ │
                    │                    │ postgres :5432 │ │
                    │                    └────────────────┘ │
                    └───────────────────────────────────────┘
```

One process runs the app **and** the worker (the worker starts on first request and drains the job queue). For higher throughput you can run extra standalone workers later (`npm run worker`) — the CAS-claim queue makes that safe.

---

## 1. Create the VM

### Oracle Cloud Always Free (recommended — $0/mo)
1. Console → ☰ → **Compute → Instances → Create instance**.
2. **Image:** `Canonical Ubuntu 22.04` (choose the **aarch64 / Arm** build).
3. **Shape:** `VM.Standard.A1.Flex` → set **2 OCPU / 8 GB** (Always-Free eligible).
   - If it says **“Out of host capacity”**, either retry over the next hours/days, or temporarily use `VM.Standard.E2.1.Micro` (AMD, 1 GB — still free) to get going.
4. **Networking:** leave defaults (new VCN + public subnet). **Make sure “Assign a public IPv4 address” is checked.**
5. **SSH keys:** **Save private key + Save public key**. Guard the private key — it’s your only login.
6. **Create.** Wait for **Status: Running**, then copy the **Public IP**.

### Hetzner fallback (€3.29/mo, easiest signup)
1. Cloud → Add Server → **CAX11** (2 vCPU / 4 GB, ARM) or **CX22** (x86).
2. Image: **Ubuntu 22.04**. Add your SSH public key. Create. Note the IP.

> ARM vs x86: EvalDesk runs on both. Oracle free is ARM, so prefer ARM images there.

---

## 2. Open the firewall (the #1 gotcha — don’t skip)

### On Oracle ONLY (Hetzner skips this — ports are open by default)
Oracle blocks **all** inbound traffic in two places. Open ports **80 + 443** in **both**:

**A. VCN Security List**
- Console → Networking → Virtual Cloud Networks → your VCN → Security Lists → Default Security List → **Add Ingress Rules**:
  - `0.0.0.0/0` TCP **80**  Source
  - `0.0.0.0/0` TCP **443**

**B. Instance iptables** (Oracle images ship a restrictive iptables). SSH in (see step 3) and run:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```
If the app still can’t be reached, this is almost always why.

---

## 3. SSH in & install Docker

```bash
# from your laptop (use the private key you saved; oracleuser for Oracle, root for Hetzner)
ssh -i ~/.ssh/your-key ubuntu@<VM_PUBLIC_IP>      # Oracle
# ssh -i ~/.ssh/your-key root@<VM_PUBLIC_IP>      # Hetzner

# on the VM — install Docker + compose plugin (official one-liner)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # apply the docker group without re-logging-in
docker --version && docker compose version        # sanity check
```

---

## 4. Get the code + configure secrets

```bash
git clone https://github.com/ramandagar/EvalDesk.git
cd EvalDesk
cp .env.example .env
```

**Edit `.env`** — set **at least these three** (EvalDesk fails closed without them):

```bash
# 1. A strong DB password (use the SAME value in DATABASE_URL below)
POSTGRES_PASSWORD=$(openssl rand -base64 24)

# 2. Encryption key (generate fresh)
#    On the VM run:  openssl rand -base64 32
EVALDESK_ENCRYPTION_KEYS=dev1:<paste that base64 key>
EVALDESK_ACTIVE_KEY_ID=dev1

# 3. Make DATABASE_URL use the password you set:
DATABASE_URL=postgres://evaldesk:<SAME_PASSWORD>@db:5432/evaldesk
```

Then add your AI judge key (BYO — pick one):
```bash
JUDGE_PROVIDER=deepseek
JUDGE_MODEL=deepseek-chat
DEEPSEEK_API_KEY=sk-your-deepseek-key
```

> **Leave `DB_DRIVER=postgres`.** SQLite is for local dev only.

---

## 5. Launch

```bash
docker compose up -d --build       # builds the image + starts app + postgres
docker compose logs -f evaldesk    # watch it boot; Ctrl-C to exit logs
```

On first request the app **auto-migrates Postgres** and starts the worker.

**Verify it’s alive (from the VM first):**
```bash
curl http://localhost:3000/api/health
# expect: {"status":"ok","db":{"driver":"postgres","reachable":true},"worker":{...}}
```

Then from your laptop:
```bash
curl http://<VM_PUBLIC_IP>:3000/api/health    # if this times out → firewall (step 2)
```

---

## 6. Put it behind HTTPS (free, via Cloudflare)

You don’t strictly need this to launch — you can use `http://<VM_IP>:3000`. But for a real product (and for the Secure session cookie in production), use a domain + HTTPS.

1. **Buy a domain** (~$10/yr, Cloudflare or Porkbun) or use a free `*.up.railway.app`-style subdomain if you switched hosts.
2. **Cloudflare (free):** add your domain → DNS **A record** `app.yourdomain.com` → `<VM_PUBLIC_IP>`, proxied (orange cloud).
3. Cloudflare’s **SSL/TLS** → mode **Full** (or Flexible if you skip the origin cert below).
4. (Optional, strongest) Run **Caddy** on the VM for automatic origin TLS + proxy to :3000:
   ```bash
   # one-liner Caddy that reverse-proxies app.yourdomain.com -> evaldesk:3000
   docker run -d --name caddy --restart unless-stopped \
     -p 80:80 -p 443:443 \
     -v caddy_data:/data \
     caddy caddy reverse-proxy --from app.yourdomain.com --to host.docker.internal:3000
   ```
   (Caddy auto-provisions a Let’s Encrypt cert at the origin.)

Then visit **`https://app.yourdomain.com`** → sign up → you’re live.

---

## 7. Post-launch operations

| Task | Command |
|---|---|
| **Update to latest code** | `git pull && docker compose up -d --build` |
| **View logs** | `docker compose logs -f evaldesk` (structured JSON) |
| **DB shell** | `docker compose exec db psql -U evaldesk evaldesk` |
| **Back up DB** | `docker compose exec db pg_dump -U evaldesk evaldesk > backup.sql` |
| **Seed demo data** | `docker compose exec evaldesk npx tsx scripts/seed-demo.ts` |
| **Run a 2nd worker** (more throughput) | `docker compose exec evaldesk npm run worker` (or add a service) |
| **Restart** | `docker compose restart` |

**Backups:** schedule a nightly `pg_dump` (cron) → copy off the VM (e.g. to a free Cloudflare R2 bucket). The Postgres volume (`pgdata`) is where all your data lives — back it up.

---

## 8. Troubleshooting

- **App unreachable from outside but works on `localhost:3000`** → Oracle firewall (step 2). Open 80/443 in both the Security List **and** iptables.
- **`POSTGRES_PASSWORD is required` / app crashes on boot** → secrets missing in `.env`, or `DATABASE_URL` password doesn’t match `POSTGRES_PASSWORD`.
- **`Encryption not configured`** → `EVALDESK_ENCRYPTION_KEYS` / `EVALDESK_ACTIVE_KEY_ID` unset in `.env`. EvalDesk fails closed by design.
- **Runs stay “queued” forever** → the worker didn’t start. Check `docker compose logs evaldesk | grep worker`. It starts on first request; hit `/api/health` to trigger boot, or set `EVALDESK_DISABLE_WORKER=0`.
- **Build fails on `better-sqlite3`** → the Dockerfile already adds `python3 make g++`; if you customized it, ensure native build tools are present in the deps stage.
- **Slow large runs** → expected; evals are sequential and gated by the LLM provider’s rate limit. To speed up, run extra workers (`npm run worker`) — the queue is CAS-safe.

---

## Cost summary

| Item | Cost |
|---|---|
| Oracle Always-Free ARM VM (2 OCPU / 8 GB) | **$0/mo** |
| 200 GB block storage + 10 TB egress | **$0** (within free tier) |
| Domain | ~$10/**year** |
| Cloudflare DNS + HTTPS | **$0** |
| LLM judge tokens | **$0 to you** (BYO-key — the customer pays) |
| **Total to launch** | **$0/mo** (+ optional ~$10/yr domain) |

When you outgrow free tier (hundreds of active users) or an enterprise buyer requires AWS, the Docker + Postgres + env-var design means migrating is a data dump + DNS change — no rewrite.
