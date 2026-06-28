# Competitor Analysis Agent

CompetitorAnalysis scrapes through competitor webpages, socials, and blog posts, benchmarks them against your baseline signals, and provides prioritized CRO and UX recommendations. You can customize target baseline settings, checkbox-filter the competitor list dynamically, and tune the AI system prompts directly in the dashboard UI.

---

## 🌟 Core Features

- **Selective Competitor Analysis:** Benchmarks selectively using interactive checkboxes on the dashboard UI.
- **Generic Target Configuration:** Configure *any* company as the benchmarking baseline (defaults to vidaXL).
- **Custom AI Prompt Editors:** Edit the **Competitor Analyzer System Prompt** and **Report Synthesizer System Prompt** directly from the UI Configuration tab.
- **Zero-Competitor Safeguard:** Handles runs with no selected brands by rendering a warning alert instead of generating empty comparison reports.
- **Visual Page Design Assessments:** Prompted to extract layout details, product grid densities, hero structures, and header navigation elements.
- **Report History Index:** Auto-archives timestamped runs inside a `reports/` folder, searchable on the UI.

---

## 📂 Project Structure

- **`server.js`:** Express backend managing configurations and triggering n8n execute commands.
- **`public/`:** SPA Frontend assets (glassmorphism UI layout, styling sheets, state handlers).
- **`existing_workflow.json`:** n8n workflow JSON configuration schema.
- **`context.md`:** Reference guide detailing node structures, commands, and schemas.
- **`architecture.md`:** Detailed systems topology and data flow diagrams.
- **`deploymentPlan.md`:** Guide for deploying to Railway (Single Container vs. Multi-service API).

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have Node.js and n8n installed locally:
```bash
npm install -g n8n
```

### 2. Installation
Clone the repository and install the dependencies:
```bash
git clone https://github.com/achukkapalli/CompetitorAnalysis.git
cd CompetitorAnalysis
npm install
```

### 3. Run the Dashboard
Start the Express server on Port 3000:
```bash
node server.js
```
Open **[http://localhost:3000](http://localhost:3000)** in your web browser.

### 4. Workflow Visualizer (Optional)
Open the local n8n editor at **[http://localhost:5678](http://localhost:5678)** to view or manually trigger nodes.
http://localhost:5678/workflow/P4bBNPzkRmQCXVHl
