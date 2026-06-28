# Railway Deployment Plan: Competitor Benchmarking Dashboard

This document outlines the strategies, configuration templates, and step-by-step procedures to deploy the dashboard server and n8n workflows onto **Railway**.

---

## 1. Deployment Strategies

You can choose between two main architectures depending on your scaling and robustness requirements:

| Strategy | Architecture | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **Option A (Fastest)** | **Single Container PM2 / Supervisor**<br>Runs both Express and n8n inside one Docker container using a startup script. | Keeps the local file system and CLI commands intact. No code modifications needed. | Shared container CPU/Memory, transient storage restarts clear report history unless volumes are mounted. |
| **Option B (Production)** | **Multi-Service Architecture**<br>Deploy Express backend and n8n as separate Railway services. n8n connects to a PostgreSQL database. | Scalable, persistent database storage, zero-downtime redeploys. | Requires replacing local CLI commands with n8n REST API calls. |

---

## 2. Option A: Single Container PM2 Setup (Recommended for Quick Setup)

In this approach, Railway builds a custom Docker image that starts n8n globally and launches `server.js` simultaneously.

### Step 1: Create a `Dockerfile`
Create a file named `Dockerfile` in the root of the workspace:

```dockerfile
FROM node:20-alpine

# Install git, bash, python, build tools (required for n8n native node builds)
RUN apk add --no-cache bash git openssh build-base python3

# Install n8n globally
RUN npm install -g n8n pm2

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy application files
COPY . .

# Expose Express server port (Railway overrides this with $PORT)
EXPOSE 3000

# Copy start script and make it executable
RUN chmod +x start.sh

CMD ["./start.sh"]
```

### Step 2: Create a `start.sh` startup script
Create a file named `start.sh` in the root of the workspace:

```bash
#!/bin/bash

# Start n8n in the background on port 5678
echo "Starting n8n..."
export N8N_PORT=5678
export N8N_ENCRYPTION_KEY="your-custom-secure-key"
n8n start &

# Wait 5 seconds for n8n to initialize
sleep 5

# Import the existing workflow to n8n database
echo "Importing existing workflow..."
n8n import:workflow --input=existing_workflow.json

# Start the Express dashboard using PM2 in the foreground
echo "Starting Express Dashboard Server..."
pm2-runtime start server.js
```

### Step 3: Add Volume Mount (For persistent reports history)
By default, Railway container file systems are ephemeral. To prevent report history from getting wiped on redeploys:
1. In your Railway service settings, go to the **Variables** or **Volumes** tab.
2. Click **Add Volume** and mount it to `/app/reports`.
3. This ensures all generated HTML reports remain stored historically.

---

## 3. Option B: Production Multi-Service Architecture

To deploy n8n and the Express dashboard as independent cloud services:

```
[ Dashboard Client ] ---> [ Express Backend (Service A) ] 
                                  |
                                  +--> [ n8n REST API (Service B) ] ---> [ PostgreSQL DB ]
```

### Step 1: Deploy n8n on Railway
1. Go to Railway and select **New Project** -> **Deploy from Template** -> search for **n8n**.
2. This template automatically provisions:
   - An n8n service container.
   - A PostgreSQL database container linked via variables (`DB_TYPE=postgresdb`, `DB_POSTGRESDB_HOST`, etc.).
3. Note your deployed n8n URL (e.g. `https://n8n-production-xxxx.up.railway.app`).

### Step 2: Update Express Backend `server.js` to use n8n REST API
Instead of executing local child processes (`n8n import` / `n8n execute`), rewrite the backend handlers to use the n8n REST API endpoints:
- **Save Config:** Update the workflow json variables using `PUT /api/v1/workflows/:id`.
- **Trigger Scraper:** Start the workflow execution using `POST /api/v1/workflows/:id/executions`.

Example Node.js fetch call:
```javascript
const n8nUrl = process.env.N8N_API_URL; // e.g. https://n8n-production-xxxx.up.railway.app
const apiKey = process.env.N8N_API_KEY;  // Generated in n8n settings

async function triggerWorkflowRun(workflowId) {
  const response = await fetch(`${n8nUrl}/api/v1/workflows/${workflowId}/executions`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
}
```

---

## 4. Required Railway Environment Variables

Configure the following variables in the **Variables** tab of your Express service on Railway:

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Injected automatically by Railway to route HTTP traffic. |
| `NODE_ENV` | `production` | Tells Node.js to run in production mode. |
| `GROQ_API_KEY` | `gsk_...` | (Optional) Pre-injected Groq API Key. |
| `PAGESPEED_API_KEY` | `AIza...` | (Optional) Pre-injected PageSpeed API Key. |

> [!IMPORTANT]
> **API Key Setup:** For security compliance, API keys are not stored or hardcoded in the source code. Upon deploying the dashboard, navigate to the **Configuration** tab in your browser and enter your **Groq API Key** and **PageSpeed API Key** directly in the form inputs, then click **Save Configuration** to sync them to the database.
