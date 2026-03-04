# Docker Command Center (DCC)
## User Guide & How-To Documentation

**Version:** 2.3.0
**Document Date:** March 4, 2026
**Audience:** End Users, DevOps Engineers, System Administrators

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Web Interface Guide](#web-interface-guide)
3. [Mobile App Guide](#mobile-app-guide)
4. [Common Tasks](#common-tasks)
5. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation & Setup

#### Linux (Ubuntu/Debian)

**Prerequisites:**
- Docker Engine 20.10+
- Administrator access
- 512MB RAM minimum

**Steps:**

1. **Download and install the .deb package:**
```bash
wget https://releases.docker-command-center.io/dcc_2.0.0_amd64.deb
sudo dpkg -i dcc_2.0.0_amd64.deb
```

2. **Verify installation:**
```bash
systemctl status dcc
journalctl -u dcc -f
```

3. **Access the web interface:**
Open browser to `http://localhost:8081`

Default credentials are shown in logs. Change immediately.

**Configuration:**
```bash
sudo nano /etc/dcc/dcc.env
```

Available environment variables:
```env
DCC_PORT=9876                    # API port
DCC_UI_PORT=8081                 # Web UI port
DCC_LOG_LEVEL=info               # debug/info/warn/error
DCC_MAX_LOG_LINES=10000          # Container log history
DCC_METRICS_INTERVAL=5s          # Metrics update interval
DCC_AUDIT_RETENTION=90d          # Keep audit logs for N days
DCC_TLS_ENABLED=false            # Enable HTTPS
DCC_TLS_CERT=/path/to/cert.pem   # Certificate path
DCC_TLS_KEY=/path/to/key.pem     # Key path
```

#### Docker Compose

```bash
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  dcc:
    image: docker-command-center/dcc:2.0.0
    ports:
      - "9876:9876"
      - "8081:8081"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - dcc-data:/etc/dcc
    environment:
      DCC_LOG_LEVEL: info
    restart: unless-stopped

volumes:
  dcc-data:
EOF

docker-compose up -d
```

#### macOS (Docker Desktop)

1. Install Docker Desktop
2. Download DCC from App Store (when available)
3. Grant docker.sock access permission
4. Start from Applications folder

#### Windows (Docker Desktop + WSL2)

1. Enable WSL2 backend in Docker Desktop
2. Download DCC Windows installer
3. Run installer
4. Access via `http://localhost:8081`

### Initial Configuration

#### Step 1: Create API Key

1. Login with default credentials
2. Go to Settings → API Keys
3. Click "Generate New Key"
4. Name it (e.g., "Mobile App", "CI/CD")
5. Copy the key - you won't see it again
6. Set expiration date (90 days recommended)

#### Step 2: Configure Remote Systems (Optional)

To manage multiple Docker hosts:

1. Go to Settings → System Switcher
2. Click "Add System"
3. Enter:
   - System Name: "Production Server"
   - URL: `https://prod.example.com:9876`
   - API Key: (paste key from step 1)
4. Click "Test Connection"
5. Save

#### Step 3: Configure Notifications (Optional)

1. Settings → Notifications
2. Choose channel (Email, Slack, PagerDuty, Webhook)
3. Configure credentials
4. Test notification

#### Step 4: Set Preferences

1. Settings → Appearance
   - Toggle Dark/Light mode
   - Enable Compact View (fit more on screen)
   - Set Refresh Interval (default: 5 seconds)

2. Settings → Alerts
   - CPU Usage Threshold: 80%
   - Memory Usage Threshold: 85%
   - Disk Usage Threshold: 90%

---

## Web Interface Guide

### Dashboard

The main view shows at-a-glance status of your entire deployment.

**Key Sections:**

#### System Health Card
```
┌─────────────────────────────────┐
│ System Health                   │
├─────────────────────────────────┤
│ CPU Usage:     45% [████░░░░░]  │
│ Memory:        62% [██████░░░░] │
│ Disk:          73% [███████░░░] │
│ Containers:    12 running       │
│ Networks:      5 custom         │
│ Volumes:       8 total          │
└─────────────────────────────────┘
```

**Actions:**
- Click health metric to see detailed breakdown
- Hover for historical trend
- Color indicates status (green ≤80%, yellow 80-90%, red >90%)

#### Recent Activity
Shows last 10 actions:
- Container starts/stops
- Deployments
- Volume mounts
- System changes

Click any entry to see details and audit trail.

#### Quick Actions
- **Deploy Stack**: Upload docker-compose.yml
- **Create Container**: Run image with config
- **Add Volume**: Create new named volume
- **Create Network**: Define custom network

### Containers Screen

View and manage all containers.

#### Container List

Each container shows:
- **Name**: Container hostname
- **Status**: Running/Stopped/Restarting
- **Image**: Repository:tag
- **Ports**: Exposed ports (click to proxy)
- **CPU/Memory**: Current usage (click for graph)

**Sorting & Filtering:**
- Sort by: Name, Status, CPU, Memory, Created
- Filter by: Status (running/stopped), Image, Network

#### Container Details

Click any container to expand details:

**Overview Tab:**
- Image ID and pull time
- Port mappings
- Environment variables
- Volume mounts
- Networks connected
- Health status

**Logs Tab:**
- Real-time log stream
- Search logs (Ctrl+F)
- Timestamp toggle
- Line count selector
- Download logs

**Resources Tab:**
- CPU graph (5-minute history)
- Memory graph
- Network I/O (bytes in/out)
- Disk I/O

**Terminal Tab:**
```bash
> _
```
Interactive terminal inside container. Type commands and see results.

**Actions:**
- **Start/Stop**: Change container state
- **Restart**: Force restart
- **Delete**: Remove stopped container (requires confirmation)
- **Pause/Unpause**: Freeze container (running only)
- **Copy ID**: Copy container ID to clipboard

### Stacks Screen

Manage Docker Compose projects.

#### Stack List

Shows each compose project:
- **Project Name**: From directory or service label
- **Status**: Running/Partial/Stopped (badge color)
- **Services**: Count of services in stack
- **Created**: When first deployed
- **Updated**: Last modification time

**Quick Actions per Stack:**
- **Start**: ▶ Start all services
- **Stop**: ⏹ Stop all services
- **Restart**: 🔄 Restart all services
- **Delete**: 🗑 Remove all containers

#### Deploy New Stack

**Option 1: Upload File**
1. Click "Deploy Stack"
2. Select docker-compose.yml file
3. Choose environment (optional)
4. Review services
5. Click "Deploy"

**Option 2: Paste Content**
1. Click "Deploy Stack"
2. Select "Paste YAML"
3. Paste compose file contents
4. Click "Deploy"

**Deployment Process:**
```
1. Validate YAML structure
2. Create networks (if new)
3. Create volumes (if new)
4. Pull images (may take 5+ minutes)
5. Create services
6. Start containers
```

#### Stack Details

Click stack name to expand:

**Services Tab:**
Shows tree of services with:
- Service name
- Image
- Status
- Port mappings
- Start/stop controls (per service)

**Environment Tab:**
- Environment variables from .env file
- Can override per deployment

**Logs Tab:**
- Combined logs from all services
- Filter by service
- Tail count (last 100/1000/all lines)

**Files Tab:**
- docker-compose.yml preview
- .env file preview (if available)
- Recent deployment history

### Volumes Screen

Browse and manage storage.

#### Volume List

Each volume shows:
- **Name**: Volume identifier
- **Driver**: Local/NFS/other
- **Size**: Allocated/Used space
- **Containers**: How many containers use it
- **Created**: When first created

#### Volume Browser

Click volume name to browse contents:

```
/home/
  ├── user/
  │   ├── .bashrc           (412 B)
  │   ├── docker/           (4.2 MB)
  │   │   ├── app.log       (2.1 MB)
  │   │   └── config.json   (45 KB)
  │   └── data/
  └── root/
```

**Features:**
- Click folders to expand
- Click files to preview (text files only)
- Right-click for options:
  - Download
  - View full content
  - Edit permissions (future)

#### Volume Operations

**Create Volume:**
1. Click "Create Volume"
2. Enter name
3. Choose driver (usually "local")
4. Set options (optional)
5. Create

**Delete Volume:**
1. Select volume (checkbox)
2. Click "Delete Selected"
3. Confirm (warns if containers using it)

**Manage Containers:**
Click container count to see which containers mount this volume.

### Networks Screen

Visualize and manage Docker networks.

#### Network List

Shows all networks:
- **Name**: Network identifier
- **Driver**: Bridge/Host/Overlay/None
- **Containers**: Connected container count
- **Scope**: Local/Swarm
- **Internal**: Whether isolated from external traffic

#### Network Details (Expandable)

Click network to see:

**Overview:**
- Full network ID
- Subnet range (CIDR)
- Gateway IP
- IPv6 settings
- Created date

**Containers:**
Table showing:
- Container name
- IP address on network
- MAC address
- Custom hostname (if set)

**IPAM Config:**
- Subnet: 172.18.0.0/16
- Gateway: 172.18.0.1
- IP Pool: 172.18.0.2 - 172.18.255.254

**Driver Options:**
- Advanced configuration shown
- Custom labels displayed

#### Network Operations

**Create Network:**
1. Click "Create Network"
2. Enter name (e.g., "web-network")
3. Choose driver:
   - **Bridge**: Default, single host
   - **Overlay**: Multi-host (Swarm)
   - **Host**: Use host networking
   - **None**: No network
4. Set subnet (optional, auto-assigned)
5. Enable IPv6 (optional)
6. Create

**Connect Container:**
1. Select network
2. Click "Connect Container"
3. Choose container
4. Provide custom hostname (optional)
5. Connect

**Disconnect Container:**
1. In container list, click container
2. Find network in networks tab
3. Click "Disconnect"

**Delete Network:**
1. Check no containers connected
2. Click delete
3. Confirm

### Settings Screen

Configure DCC preferences and integrations.

#### Connection Settings

**Current System:**
Shows connected Docker host details:
- Hostname
- Docker version
- Server version
- Kernel version
- Status

**Ping Test:**
Verify connectivity to backend. Green = good, red = failed.

#### Remote Systems

**Add System:**
1. Click "Add System"
2. Name: Human-readable name
3. URL: `https://host:9876`
4. API Key: Generated from that system
5. Optional: Enable auto-retry, set timeout
6. Save

**Manage Systems:**
- Click system name to edit
- Set as default (for mobile)
- Delete (removed from list)
- View last connection time

**System Status:**
- Green dot = Online and responding
- Red dot = Offline or unreachable
- Gray dot = Never connected

#### Alerts & Thresholds

**CPU Alert Threshold:**
Send alert when CPU > X%
Default: 80%

**Memory Alert Threshold:**
Send alert when memory > X%
Default: 85%

**Disk Alert Threshold:**
Send alert when disk > X%
Default: 90%

**Test Alert:**
Button to send test alert to configured channels.

#### Appearance

**Theme:**
- Light mode
- Dark mode
- Auto (matches system)

**Layout:**
- Compact mode: Reduce spacing, show more items
- Standard mode: More breathing room
- List view vs. Card view

**Refresh Interval:**
How often to update metrics:
- 1 second (high CPU, real-time)
- 5 seconds (recommended)
- 10 seconds (slow networks)
- 30 seconds (minimal updates)

#### Notifications

**Enable Notifications:**
Toggle to enable/disable all alerts

**Channel: Email**
- SMTP Server: mail.example.com
- Port: 587
- Username: (if required)
- From Address: dcc@example.com
- Test Send: Verify configuration

**Channel: Slack**
- Webhook URL: (paste from Slack app)
- Channel: #ops, #alerts, etc.
- Mention: @ops-team, @devops, etc.
- Test Send

**Channel: PagerDuty**
- Integration Key: (from PagerDuty)
- Severity Mapping: Map DCC severity to PagerDuty
- Test Trigger

**Channel: Webhook**
- URL: https://api.example.com/alerts
- HTTP Method: POST/PUT
- Headers: (custom headers)
- Test Send

#### API Keys Management

**View Keys:**
- Key Name (partial display for security)
- Created Date
- Last Used
- Expiration Date
- Permissions (future)

**Generate Key:**
1. Click "Generate New Key"
2. Name: e.g., "Mobile App", "CI Pipeline"
3. Expiration: 30/60/90 days
4. Permissions: Select scopes (future)
5. Generate
6. Copy (shown once only!)

**Revoke Key:**
1. Find key in list
2. Click "Revoke"
3. Confirm
4. Key immediately stops working

#### Developer Options

**Debug Mode:**
Enable verbose logging and extra debugging info in UI.

**Raw JSON Toggle:**
Show API responses in raw JSON format.

**API Documentation:**
Link to interactive API docs (Swagger UI).

**Export Audit Log:**
Download audit trail as CSV for compliance.

---

## Mobile App Guide

### Installation

1. Open Google Play Store or Apple App Store
2. Search for "Docker Command Center"
3. Install free version
4. Launch app

### Initial Setup

#### Screen 1: Welcome
- App explanation and features
- Privacy policy and terms
- "Get Started" button

#### Screen 2: Add System

**Add your first system:**
1. Tap "Add System"
2. System Name: (human-readable)
3. URL: `https://your-host:9876` or IP
4. API Key: (from Settings on web)
5. Verify Certificate: For self-signed, toggle on
6. Tap "Test Connection" (should show green check)
7. Tap "Save"

### Navigation

**Drawer Menu:**
```
┌──────────────────────┐
│ ● Home Server        │ ← Active system (green dot)
│   prod.example.com   │
│ ○ Dev Server         │ ← Inactive (red/gray dot)
│   dev.example.com    │
│ ○ Staging            │
│                      │
│ + Add System         │ ← Add another
├──────────────────────┤
│ 📦 Containers        │
│ 📚 Stacks            │
│ 🗄 Volumes           │
│ 🌐 Networks          │
│ ⚙️ Settings          │
└──────────────────────┘
```

**Bottom Navigation (Android):**
- Dashboard (home icon)
- Containers (box)
- Stacks (layers)
- Volumes (database)
- Settings (gear)

**Top App Bar:**
Shows active system: "Home Server - prod.example.com"
Tap to switch systems instantly.

### Screens

#### Dashboard

**Quick Stats:**
- Containers running / total
- CPU usage (%)
- Memory usage (%)
- Disk usage (%)

**Recent Actions:**
Last containers started/stopped.

**Quick Actions:**
- Start Container (pick from list)
- View System Health
- Test Connection

#### Containers Screen

**List View:**
Each container card shows:
- Name (large)
- Status badge (green Running / gray Stopped)
- Image name (small text)
- CPU/Memory (small percentages)
- Tap to expand

**Expanded View:**
- Ports (tap to open proxy link)
- Environment vars (first 5)
- Mounted volumes (first 3)
- Connected networks (first 2)
- Start/Stop button
- View Logs link

**Logs View:**
- Real-time log stream
- Scroll to load earlier logs
- Search (magnifying glass)
- Share logs (long-press)

**Container Actions:**
- Start
- Stop (if running)
- Restart
- Delete (if stopped)
- Copy container ID

#### Stacks Screen

**Stack Cards:**
- Stack name
- Service count
- Status badge
  - Green: All running
  - Orange: Partial running
  - Gray: All stopped
- Tap to see services

**Service Tree:**
```
📦 Web Stack
├─ frontend (running)
├─ api (running)
├─ db (stopped)
└─ cache (running)
```

**Actions:**
- Start All
- Stop All
- Restart All
- Delete All
- Deploy New (upload compose file)

#### Volumes Screen

**Volume List:**
- Volume name (tap to browse)
- Size indicator
- Container count
- Delete button (swipe)

**File Browser:**
```
📁 /data
  📁 backup
    📄 db.sql (1.2 MB)
  📁 logs
    📄 app.log (450 KB)
    📄 error.log (123 KB)
  📄 config.json (45 KB)
```

Tap file to preview content.

#### Networks Screen

**Network List:**
- Network name
- Driver (bridge/overlay)
- Container count
- Tap to see containers

**Connected Containers:**
```
web         172.18.0.2
db          172.18.0.3
cache       172.18.0.4
```

#### Settings Screen

**System Switcher:**
```
● Home Server        ← Active (bullet point)
  prod.example.com
  
○ Dev Server
  dev.example.com
  
+ Add System
```

Swipe left to delete system.

**Connection Settings:**
- Current system status
- Ping test button
- Add another system link

**Alert Settings:**
- CPU threshold slider: 0-100%
- Memory threshold slider: 0-100%
- Notifications toggle
- Choose channels (Email, Slack, PagerDuty)

**Appearance:**
- Dark mode toggle
- Compact mode toggle
- Refresh interval (1s, 5s, 10s, 30s)

**Debug:**
- Show raw JSON toggle
- View audit logs

---

## Common Tasks

### Task 1: Deploy a Web Stack

**Scenario:** You have a docker-compose.yml with frontend, backend, and database.

**Steps:**

1. **Prepare compose file:**
```yaml
version: '3.8'
services:
  web:
    image: myapp:latest
    ports:
      - "80:3000"
    environment:
      DB_HOST: db
    depends_on:
      - db
  db:
    image: postgres:13
    environment:
      POSTGRES_PASSWORD: secretpass
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  db-data:
```

2. **Deploy via Web UI:**
   - Go to Stacks → Deploy Stack
   - Click "Upload File"
   - Select the docker-compose.yml
   - Review services (should show: web, db)
   - Click "Deploy"
   - Wait for images to pull (~2-5 minutes)

3. **Verify deployment:**
   - Go to Containers screen
   - Check both containers are running (green status)
   - Click on web container
   - Find the port mapping (0.0.0.0:80→3000)
   - Click port to open in browser

4. **Check logs:**
   - Click on each container → Logs tab
   - Verify no error messages
   - Look for "listening on port" or "ready" messages

### Task 2: Monitor Container Performance

**Scenario:** Your API container is using high CPU.

**Steps:**

1. **Find the container:**
   - Containers screen
   - Sort by CPU (descending)
   - Find your API container

2. **View resource metrics:**
   - Click container
   - Resources tab
   - See CPU graph for last 5 minutes
   - Memory graph for last 5 minutes
   - Network I/O graph

3. **Inspect processes:**
   - Terminal tab
   - Run: `top -bn1`
   - See which processes use CPU
   - Run: `ps aux | grep <process_name>`

4. **Take action:**
   - If legitimate: Increase CPU limit in docker-compose.yml
   - If runaway process: Restart container via UI
   - Check logs for errors causing high CPU

5. **Set alert:**
   - Settings → Alerts
   - Set CPU threshold to 70%
   - Future spikes will trigger notifications

### Task 3: Browse and Understand Volume Contents

**Scenario:** Your database volume is growing large. Want to investigate.

**Steps:**

1. **Go to Volumes screen**

2. **Find the volume:**
   - Look for volume connected to database container
   - Click volume name to browse

3. **Navigate structure:**
   - Expand directories by clicking folder icon
   - Total size shown per folder
   - Click files to preview

4. **Identify large files:**
   - Most-size files usually at bottom
   - Sort by size if available
   - Example: old backup files, logs

5. **Take action:**
   - If safe to delete: Use file explorer
   - If connected to running container: Better to SSH into container
   - Increase volume size if normal growth

### Task 4: Create and Configure a Network

**Scenario:** You want to isolate certain microservices on a custom network.

**Steps:**

1. **Create network:**
   - Networks → Create Network
   - Name: "microservices-net"
   - Driver: Bridge
   - Subnet: 10.0.0.0/24 (optional)
   - Create

2. **Connect containers:**
   - Find each container
   - Container detail → Networks
   - Connect to "microservices-net"
   - Optional: Set hostname (e.g., "api", "db")

3. **Verify connectivity:**
   - Go to Terminal tab on one container
   - `ping api` (should work if api container also on network)
   - `curl api:3000` (if api service on port 3000)

4. **Update docker-compose.yml (for persistence):**
```yaml
networks:
  microservices-net:
    driver: bridge
    ipam:
      config:
        - subnet: 10.0.0.0/24

services:
  api:
    image: myapi:latest
    networks:
      - microservices-net
  db:
    image: postgres:13
    networks:
      - microservices-net
```

### Task 5: Manage API Keys and Security

**Scenario:** You want to secure access for multiple services.

**Steps:**

1. **Create API keys:**
   - Settings → API Keys
   - Generate New Key
   - Name: "Mobile App"
   - Expiration: 90 days
   - Generate
   - **Important:** Copy and store securely (paste into password manager)

2. **Create additional keys:**
   - Generate Key 2: "CI/CD Pipeline"
   - Generate Key 3: "Monitoring Bot"

3. **Distribute securely:**
   - Mobile app: Give key only to authorized users
   - CI/CD: Store in CI secrets (GitHub, GitLab, etc.)
   - Monitoring: Store in monitoring system (Prometheus, Datadog, etc.)

4. **Revoke compromised keys:**
   - If key leaked: API Keys → Revoke
   - Confirm revocation
   - Key stops working immediately
   - Generate new key to replace

5. **Rotate keys periodically:**
   - Quarterly review of all keys
   - Create new keys
   - Update all services
   - Revoke old keys

---

## Troubleshooting

### Issue: Can't connect to DCC

**Symptoms:**
- Web page won't load
- Mobile app shows "Connection failed"
- "Cannot connect to server"

**Solutions:**

1. **Check DCC is running:**
```bash
systemctl status dcc
ps aux | grep dcc
```

If not running:
```bash
sudo systemctl start dcc
sudo systemctl enable dcc
```

2. **Check ports are accessible:**
```bash
# Check if port 8081 is listening
netstat -tlnp | grep 8081
# or
ss -tlnp | grep 8081
```

3. **Check firewall:**
```bash
# Linux
sudo ufw status
sudo ufw allow 8081/tcp
sudo ufw allow 9876/tcp

# macOS
sudo pfctl -s nat | grep 8081
```

4. **Check Docker socket:**
```bash
ls -la /var/run/docker.sock
# User running dcc must have rw permission
```

### Issue: Docker daemon not responding

**Symptoms:**
- "Failed to connect to Docker daemon"
- No containers showing in UI
- Logs say "docker: connection refused"

**Solutions:**

1. **Check Docker is running:**
```bash
docker ps
# If error, restart Docker
sudo systemctl restart docker
```

2. **Check socket permissions:**
```bash
ls -la /var/run/docker.sock
# Should be: srw-rw---- 1 root docker

# If DCC user not in docker group:
sudo usermod -aG docker dcc
sudo systemctl restart dcc
```

3. **Check Docker context:**
```bash
docker context ls
# Make sure using correct context if multiple
```

### Issue: Container logs not showing

**Symptoms:**
- Logs tab is empty
- "No logs available"
- Spinner stuck on loading

**Solutions:**

1. **Check container is running:**
```bash
docker ps
```

2. **Check log file isn't too large:**
```bash
docker inspect <container_id> | grep LogPath
ls -lh <log_path>
# If >1GB, might be performance issue
```

3. **Restart container:**
   - In UI: Container → Restart
   - Logs should appear if container outputs anything

4. **Check container command:**
```bash
docker inspect <container_id> | grep -A 10 "Cmd"
# If container doesn't output to stdout, won't see logs
```

### Issue: High memory/CPU usage in DCC

**Symptoms:**
- DCC process using >100% CPU
- Memory steadily increasing
- UI becoming slow

**Solutions:**

1. **Reduce refresh interval:**
   - Settings → Appearance
   - Change from 1s to 5s or 10s
   - Reduces polling frequency

2. **Increase log retention:**
   - Settings → Developer
   - Or edit `/etc/dcc/dcc.env`:
   ```bash
   DCC_MAX_LOG_LINES=1000  # Reduce from 10000
   ```

3. **Restart DCC:**
```bash
sudo systemctl restart dcc
```

4. **Check for log file bloat:**
```bash
journalctl -u dcc --disk-usage
journalctl -u dcc --vacuum-time=7d
```

### Issue: Network connectivity between containers broken

**Symptoms:**
- Containers can't reach each other
- "Connection refused" between services
- DNS not resolving

**Solutions:**

1. **Check containers are on same network:**
   - Container A detail → Networks → should see shared network
   - Container B detail → Networks → should see shared network

2. **Test connectivity:**
```bash
# Inside container A
docker exec <container_a> ping <container_b_hostname>
docker exec <container_a> curl http://<container_b_hostname>:3000
```

3. **Verify network exists:**
   - Networks screen → find shared network
   - Click to see connected containers
   - Both should be listed

4. **Fix compose file (if applicable):**
```yaml
services:
  a:
    image: a:latest
    networks:
      - shared
  b:
    image: b:latest
    networks:
      - shared

networks:
  shared:
    driver: bridge
```

5. **Recreate network:**
   - Delete network (if no running containers)
   - Redeploy stack
   - Containers will reconnect

### Issue: Can't see remote system in mobile app

**Symptoms:**
- Mobile shows "Connection failed"
- Web interface works fine
- "System offline" error

**Solutions:**

1. **Check system was added correctly:**
   - Settings → System Switcher
   - Verify URL: should be accessible from phone network
   - Use IP address, not localhost

2. **Check firewall from phone:**
   - Open browser on phone
   - Try `https://your-host:9876`
   - If blank page, firewall/network issue
   - If error page, DCC is reachable

3. **Check API key is valid:**
   - Mobile: remove system
   - Web: Settings → API Keys
   - Verify key isn't expired
   - Generate new key if needed
   - Add back to mobile with new key

4. **Test from phone command line:**
```bash
# Connect phone to computer via USB debugging
adb shell
curl https://your-host:9876/api/monitoring/health
```

### Issue: Volumes not mounting or showing in containers

**Symptoms:**
- Volume created but not in container
- Container can't write to volume
- Files not persisting

**Solutions:**

1. **Check volume exists:**
   - Volumes screen
   - Volume should be listed
   - Click to browse (should show files)

2. **Check docker-compose.yml:**
```yaml
services:
  app:
    image: myapp:latest
    volumes:
      - my-volume:/data  # Check mount path correct
      - /host/path:/container/path  # For bind mounts
```

3. **Verify mount in container:**
```bash
# Inside container
df -h                    # See mounted volumes
ls -la /data            # Check mount point
```

4. **Check permissions:**
```bash
ls -la /var/lib/docker/volumes/my-volume/_data/
# May need: chmod 777 if permission denied
```

### Issue: API key not working

**Symptoms:**
- "Unauthorized" errors
- Mobile app keeps asking for key
- CI/CD pipeline failing

**Solutions:**

1. **Verify key is still valid:**
   - Settings → API Keys
   - Check it's not expired
   - Check it hasn't been revoked

2. **Check key format:**
   - Should be full key (copy from generate dialog)
   - Not truncated
   - Pass in header: `Authorization: Bearer <key>`

3. **For mobile app:**
   - Settings → System Switcher
   - Delete system
   - Re-add with correct key
   - Test connection

4. **For API calls:**
```bash
# Should work:
curl -H "Authorization: Bearer abc123..." http://localhost:9876/api/containers

# Wrong:
curl -H "Authorization: abc123..." ...  # Missing "Bearer"
curl -H "X-API-Key: abc123..." ...      # Wrong header
```

5. **Generate new key:**
   - If all else fails, create fresh key
   - Update all clients with new key
   - Revoke old key

---

## Getting Help

- **Documentation:** https://docs.docker-command-center.io
- **GitHub Issues:** https://github.com/docker-command-center/dcc/issues
- **Community Forum:** https://community.docker-command-center.io
- **Email Support:** support@docker-command-center.io
