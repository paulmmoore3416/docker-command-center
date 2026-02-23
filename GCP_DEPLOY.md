# GCP Deployment Guide — Docker Command Center

## One-Time VM Setup

### 1. Create the VM

```bash
gcloud compute instances create dcc-server \
  --machine-type=e2-medium \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=20GB \
  --tags=http-server,https-server \
  --zone=us-central1-a
```

### 2. Open firewall for port 9876

```bash
gcloud compute firewall-rules create allow-dcc \
  --allow tcp:9876 \
  --target-tags=http-server \
  --description="Docker Command Center"
```

### 3. SSH in and install dependencies

```bash
gcloud compute ssh dcc-server --zone=us-central1-a
```

Inside the VM:

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# Go 1.24
wget https://go.dev/dl/go1.24.0.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.24.0.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc
go version

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git make
node --version && npm --version
```

### 4. Clone and deploy

```bash
git clone https://github.com/paulmmoore3416/docker-command-center.git
cd docker-command-center
make build
./dcc
```

Access: `http://<YOUR_VM_EXTERNAL_IP>:9876`

Find your IP:
```bash
gcloud compute instances describe dcc-server \
  --zone=us-central1-a \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

---

## Install as systemd Service (Recommended)

Keeps DCC running after reboots and auto-restarts on crash.

```bash
sudo tee /etc/systemd/system/dcc.service > /dev/null << 'EOF'
[Unit]
Description=Docker Command Center
After=docker.service
Requires=docker.service

[Service]
ExecStart=/usr/local/bin/dcc
Restart=always
RestartSec=5
User=paul
WorkingDirectory=/home/paul/docker-command-center
Environment=DCC_API_KEY=REPLACE_WITH_YOUR_SECRET_KEY

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable dcc
sudo systemctl start dcc
sudo systemctl status dcc
```

---

## Updating DCC

```bash
cd ~/docker-command-center
git pull
make build
sudo cp dcc /usr/local/bin/dcc
sudo systemctl restart dcc
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DCC_API_KEY` | Enables API key authentication | disabled |

Set in the systemd unit file or export before running:

```bash
export DCC_API_KEY=your-secure-random-key
./dcc
```

Generate a secure key:
```bash
openssl rand -hex 32
```

---

## Troubleshooting

**DCC won't connect to Docker:**
```bash
sudo usermod -aG docker $USER && newgrp docker
# or run: sudo dcc
```

**Port 9876 not reachable:**
```bash
# Verify firewall rule exists
gcloud compute firewall-rules list --filter="name=allow-dcc"

# Check DCC is listening
ss -tlnp | grep 9876
```

**Check logs:**
```bash
sudo journalctl -u dcc -f
```

**Build fails:**
```bash
# Ensure Go and Node are on PATH
go version
node --version
npm --version
```
