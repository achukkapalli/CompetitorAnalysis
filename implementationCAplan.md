# Competitor Analysis Workflow - Technical Context & Implementation Plan

This document records the context discovered regarding the local n8n instance, database status, credentials, and details the plan for building the vidaXL Competitor Analysis Workflow.

---

## 1. Context & Environment Analysis

### Local n8n Instance
- **Status:** Running (Active)
- **Port:** `5678` (listening on localhost/127.0.0.1)
- **Process ID (PID):** `7308` (Node.js wrapper)
- **Database Path:** `C:\Users\aishw\.n8n\database.sqlite`
- **Global npm Location:** `C:\Users\aishw\AppData\Roaming\npm\node_modules\n8n`

### Existing Database Assets
A pre-existing workflow was discovered in the database during inspection:
- **Workflow ID:** `P4bBNPzkRmQCXVHl`
- **Workflow Name:** `vidaXL - PR1 Competitor Analysis Report (10 Competitors)`
- **Current State:** Inactive (`active: 0`), configured with non-existent/placeholder Claude models (`claude-haiku-4-5-20251001`, `claude-sonnet-4-6`) and placeholder Anthropic credentials.
- **n8n Credentials:** Empty (`credentials_entity` table is empty; no SMTP or API keys defined).

### Verified API Credentials
- **Active Key Found:** `GROQ_API_KEY` located in `C:\Users\aishw\Documents\Review Analysis\.env`.
- **Status:** Verified and active.
- **Model Compatibility:** Fully supports `llama-3.3-70b-versatile` which will be used for JSON analysis and HTML report generation.

---

## 2. Proposed Workflow Enhancements

We will modify the existing database workflow `P4bBNPzkRmQCXVHl` to implement the following changes:

### A. Groq Integration (Self-Contained Auth)
1. **Define Config:** Update the node to set the verified `groqApiKey` parameter.
2. **LLM Nodes:**
   - **Per-Competitor Analysis:** Point to `https://api.groq.com/openai/v1/chat/completions` using the `llama-3.3-70b-versatile` model. Specify `Authorization: Bearer <key>` using the configuration property so that no separate n8n credentials setup is required.
   - **Executive Report Synthesis:** Also route to Groq (`llama-3.3-70b-versatile`) with JSON mode for structured outputs and HTML formatting.

### B. Robust Data Scraping
1. **Social Presence Check:** Replace the blocked Instagram scraper with a regex-based parser that scans the homepage HTML for active social media links (Instagram, Facebook, LinkedIn, Pinterest, YouTube, Twitter/X).
2. **PageSpeed Insights Error Mitigation:** Catch HTTP errors and rate limits gracefully, returning `null` indicators to prevent loop failures.

### C. Local Report Delivery
1. **Binary Conversion Node [NEW]:** A Code node to encode the report HTML string into a base64 binary buffer.
2. **Write Binary File Node [NEW]:** Writes the binary report to `c:\Users\aishw\Documents\Competitor analysis agent\competitor_analysis_report.html` in the workspace directory.
3. **Send Email Node:** Set to `continueOnFail: true` so the workflow finishes successfully even if the SMTP credentials are not configured.

---

## 3. Step-by-Step Execution Plan

1. **Update Workflow JSON:** Construct the revised workflow JSON incorporating the modifications.
2. **Import Workflow:** Run the command:
   `node C:\Users\aishw\AppData\Roaming\npm\node_modules\n8n\bin\n8n import:workflow --input=existing_workflow.json`
3. **Trigger Execution:** Execute the workflow via:
   `node C:\Users\aishw\AppData\Roaming\npm\node_modules\n8n\bin\n8n execute --id=P4bBNPzkRmQCXVHl`
4. **Verify Outputs:** Validate the generated local report file.
