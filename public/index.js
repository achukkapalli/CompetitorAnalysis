// Client state
let state = {
  config: null,
  reports: [],
  signals: [],
  running: false
};

// Initialise Lucide icons
function initIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Fetch active config and render tables
async function fetchConfig() {
  try {
    const res = await fetch('/api/config');
    state.config = await res.json();
    
    // Update dashboard metrics
    document.getElementById('metrics-competitors-count').textContent = state.config.competitors.length;
    
    renderCompetitorsTable();
    populateConfigForm();
  } catch (err) {
    console.error('Error fetching config:', err);
    alert('Failed to load configuration from server.');
  }
}

// Fetch reports list
async function fetchReports() {
  try {
    const res = await fetch('/api/reports');
    state.reports = await res.json();
    
    // Update dashboard metrics
    document.getElementById('metrics-reports-count').textContent = state.reports.length;
    if (state.reports.length > 0) {
      const lastReport = state.reports[0];
      const dateText = new Date(lastReport.createdTime).toLocaleString();
      document.getElementById('metrics-last-run').textContent = dateText;
    } else {
      document.getElementById('metrics-last-run').textContent = 'Never';
    }
    
    renderReportsTable();
  } catch (err) {
    console.error('Error fetching reports:', err);
  }
}

// Fetch extracted signals
async function fetchSignals() {
  try {
    const res = await fetch('/api/signals');
    state.signals = await res.json();
    renderSignalsGrid();
  } catch (err) {
    console.error('Error fetching signals:', err);
  }
}

// Render Competitors Table
function renderCompetitorsTable() {
  const tbody = document.getElementById('competitors-tbody');
  tbody.innerHTML = '';
  
  if (!state.config || state.config.competitors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#aaa;">No competitors configured.</td></tr>';
    return;
  }
  
  state.config.competitors.forEach((c, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center; vertical-align: middle;">
        <input type="checkbox" class="competitor-checkbox" data-index="${idx}" ${c.enabled !== false ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;"/>
      </td>
      <td><strong>${c.name}</strong></td>
      <td><a href="${c.homepage}" target="_blank" class="table-link">${c.homepage}</a></td>
      <td><a href="${c.blog}" target="_blank" class="table-link">${c.blog}</a></td>
      <td>${c.instagram ? `<a href="${c.instagram}" target="_blank" class="table-link">Instagram</a>` : '<span style="color:#666">None</span>'}</td>
      <td>
        <div class="action-btn-group">
          <button class="icon-btn edit-btn" data-index="${idx}"><i data-lucide="edit-2"></i></button>
          <button class="icon-btn delete-btn delete" data-index="${idx}"><i data-lucide="trash-2"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  // Attach event listeners
  document.querySelectorAll('.competitor-checkbox').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'));
      state.config.competitors[idx].enabled = e.currentTarget.checked;
      await saveConfigToServer();
    });
  });

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.currentTarget.getAttribute('data-index');
      openCompetitorModal(parseInt(idx));
    });
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.currentTarget.getAttribute('data-index');
      deleteCompetitor(parseInt(idx));
    });
  });
  
  initIcons();
}

// Render Reports History List
function renderReportsTable() {
  const tbody = document.getElementById('reports-list-body');
  tbody.innerHTML = '';
  
  if (state.reports.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:#aaa;">No archived reports found.</td></tr>';
    return;
  }
  
  state.reports.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'report-row';
    tr.setAttribute('data-filename', r.filename);
    
    const formattedTime = new Date(r.createdTime).toLocaleString();
    const sizeKB = Math.round(r.sizeBytes / 1024) + ' KB';
    
    tr.innerHTML = `
      <td><a href="#" class="report-item-link" title="${r.filename}">${r.filename}</a></td>
      <td><span class="report-time">${formattedTime}</span> &middot; <small>${sizeKB}</small></td>
      <td>
        <button class="icon-btn view-report-btn" data-filename="${r.filename}"><i data-lucide="eye"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  // Attach row click selection
  document.querySelectorAll('.report-row').forEach(row => {
    row.addEventListener('click', (e) => {
      // Ignore click if button was clicked
      if (e.target.closest('button')) return;
      const filename = e.currentTarget.getAttribute('data-filename');
      selectReport(filename);
    });
  });
  
  document.querySelectorAll('.view-report-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const filename = e.currentTarget.getAttribute('data-filename');
      selectReport(filename);
    });
  });
  
  initIcons();
}

// Preview Report in iframe
function selectReport(filename) {
  // Highlight active row
  document.querySelectorAll('.report-row').forEach(row => {
    if (row.getAttribute('data-filename') === filename) {
      row.classList.add('active');
    } else {
      row.classList.remove('active');
    }
  });
  
  const iframe = document.getElementById('report-preview-iframe');
  const placeholder = document.getElementById('preview-placeholder');
  const openLink = document.getElementById('preview-open-link');
  
  placeholder.classList.add('hidden');
  iframe.classList.remove('hidden');
  
  const url = `/api/reports/${filename}`;
  iframe.src = url;
  
  openLink.href = url;
  openLink.classList.remove('hidden');
}

// Render Extracted Signals Grid
function renderSignalsGrid() {
  const container = document.getElementById('signals-grid-body');
  container.innerHTML = '';
  
  if (state.signals.length === 0) {
    container.innerHTML = '<div class="grid-empty-state">No scraped signals available. Run the analysis scraper to populate this list.</div>';
    return;
  }
  
  state.signals.forEach(item => {
    const row = document.createElement('div');
    row.className = 'signals-grid-row';
    
    const sig = item.signals || {};
    const home = sig.homepage || {};
    const social = home.socialLinks || {};
    
    // Build social badges
    const badges = ['instagram', 'facebook', 'linkedin', 'pinterest', 'youtube', 'twitter']
      .map(network => `<span class="social-badge ${social[network] ? 'active' : 'inactive'}">${network.substring(0,2)}</span>`)
      .join('');
      
    row.innerHTML = `
      <div style="font-weight:600; padding:12px 16px;">${item.competitorName}</div>
      <div style="padding:12px 16px;" title="${home.title || 'N/A'}">${home.title || '<span style="color:#666">N/A</span>'}</div>
      <div style="padding:12px 16px;">${home.approxWordCount || 0} words</div>
      <div style="padding:12px 16px;">${home.h1Count || 0} / ${home.h2Count || 0}</div>
      <div style="padding:12px 16px;">${home.imgCount || 0} imgs</div>
      <div style="padding:12px 16px;"><div class="social-badge-list">${badges}</div></div>
      <div style="padding:12px 16px; color:#ef4444; font-size:11px;" title="${sig.pagespeed?.error || ''}">${sig.pagespeed?.error ? 'Yes (429)' : 'None'}</div>
    `;
    container.appendChild(row);
  });
}

// Populate Configuration Forms
function populateConfigForm() {
  if (!state.config) return;
  
  document.getElementById('config-groq-key').value = state.config.groqApiKey || '';
  document.getElementById('config-pagespeed-key').value = state.config.pagespeedApiKey || '';
  
  const target = state.config.targetCompany || {};
  document.getElementById('config-target-name').value = target.name || '';
  document.getElementById('config-target-home').value = target.homepage || '';
  document.getElementById('config-target-blog').value = target.blog || '';
  
  const socials = target.socials || {};
  document.getElementById('config-target-instagram').value = socials.instagram || '';
  document.getElementById('config-target-facebook').value = socials.facebook || '';
  document.getElementById('config-target-linkedin').value = socials.linkedin || '';
  
  document.getElementById('config-analysis-context').value = state.config.analysisContext || '';
  document.getElementById('config-analyzer-prompt').value = state.config.analyzerSystemPrompt || '';
  document.getElementById('config-report-prompt').value = state.config.reportSystemPrompt || '';
}

// Open Competitor Modal
function openCompetitorModal(index = null) {
  const modal = document.getElementById('competitor-modal');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('competitor-form');
  
  form.reset();
  modal.classList.remove('hidden');
  
  if (index !== null && state.config) {
    title.textContent = 'Edit Competitor';
    const c = state.config.competitors[index];
    document.getElementById('competitor-index').value = index;
    document.getElementById('comp-name').value = c.name;
    document.getElementById('comp-home').value = c.homepage;
    document.getElementById('comp-blog').value = c.blog;
    document.getElementById('comp-instagram').value = c.instagram || '';
    document.getElementById('comp-enabled').checked = (c.enabled !== false);
  } else {
    title.textContent = 'Add Competitor';
    document.getElementById('competitor-index').value = '';
    document.getElementById('comp-enabled').checked = true;
  }
  
  initIcons();
}

// Close Competitor Modal
function closeCompetitorModal() {
  document.getElementById('competitor-modal').classList.add('hidden');
}

// Save Competitor Handler
async function saveCompetitor(e) {
  e.preventDefault();
  
  const indexVal = document.getElementById('competitor-index').value;
  const cName = document.getElementById('comp-name').value;
  const cHome = document.getElementById('comp-home').value;
  const cBlog = document.getElementById('comp-blog').value;
  const cInstagram = document.getElementById('comp-instagram').value;
  const cEnabled = document.getElementById('comp-enabled').checked;
  
  const competitorObj = {
    name: cName,
    homepage: cHome,
    blog: cBlog,
    instagram: cInstagram || undefined,
    enabled: cEnabled
  };
  
  if (indexVal !== '') {
    // Edit
    const idx = parseInt(indexVal);
    state.config.competitors[idx] = competitorObj;
  } else {
    // Add
    state.config.competitors.push(competitorObj);
  }
  
  await saveConfigToServer();
  closeCompetitorModal();
}

// Delete Competitor Handler
async function deleteCompetitor(index) {
  if (!state.config) return;
  const c = state.config.competitors[index];
  if (confirm(`Are you sure you want to delete ${c.name}?`)) {
    state.config.competitors.splice(index, 1);
    await saveConfigToServer();
  }
}

// Save Config changes to Server
async function saveConfigToServer() {
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.config)
    });
    const result = await res.json();
    if (result.success) {
      await fetchConfig();
      alert('Configuration updated and synced to n8n database successfully!');
    } else {
      alert('Error: ' + result.error);
    }
  } catch (err) {
    console.error('Error saving config:', err);
    alert('Failed to save configuration settings.');
  }
}

// Submit configurations form
async function handleConfigFormSubmit(e) {
  e.preventDefault();
  if (!state.config) return;
  
  state.config.groqApiKey = document.getElementById('config-groq-key').value;
  state.config.pagespeedApiKey = document.getElementById('config-pagespeed-key').value;
  
  state.config.targetCompany = {
    name: document.getElementById('config-target-name').value,
    homepage: document.getElementById('config-target-home').value,
    blog: document.getElementById('config-target-blog').value,
    socials: {
      instagram: document.getElementById('config-target-instagram').value || undefined,
      facebook: document.getElementById('config-target-facebook').value || undefined,
      linkedin: document.getElementById('config-target-linkedin').value || undefined
    }
  };
  
  state.config.analysisContext = document.getElementById('config-analysis-context').value;
  state.config.analyzerSystemPrompt = document.getElementById('config-analyzer-prompt').value;
  state.config.reportSystemPrompt = document.getElementById('config-report-prompt').value;
  
  await saveConfigToServer();
}

// Monitor Scraper Status
async function checkScraperStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.running = data.running;
    
    const runBtn = document.getElementById('run-scraper-btn');
    const loader = document.getElementById('run-status-loader');
    
    if (state.running) {
      runBtn.disabled = true;
      loader.classList.remove('hidden');
    } else {
      if (runBtn.disabled) {
        // Scraper just completed, refresh the reports list and signals grid
        await fetchReports();
        await fetchSignals();
      }
      runBtn.disabled = false;
      loader.classList.add('hidden');
    }
  } catch (err) {
    console.error('Error checking status:', err);
  }
}

// Trigger Scraper Run
async function triggerScraperRun() {
  try {
    const res = await fetch('/api/run', { method: 'POST' });
    const data = await res.json();
    if (data.error) {
      alert('Error: ' + data.error);
      return;
    }
    
    state.running = true;
    checkScraperStatus();
  } catch (err) {
    console.error('Error triggering run:', err);
    alert('Failed to connect to local backend server.');
  }
}

// App routing and tab switcher
function handleTabChange(e) {
  const tabName = e.currentTarget.getAttribute('data-tab');
  
  // Set tab active button
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  e.currentTarget.classList.add('active');
  
  // Show active tab pane
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  document.getElementById(`tab-${tabName}`).classList.add('active');
  
  // Update header title
  const titles = {
    dashboard: 'Dashboard Overview',
    history: 'Reports History',
    competitors: 'Monitored Competitors',
    config: 'Configuration Editor',
    signals: 'Latest Scraped Signals'
  };
  document.getElementById('page-title').textContent = titles[tabName] || 'Competitor Scraper';
  
  // Custom tab load actions
  if (tabName === 'history') {
    fetchReports();
  } else if (tabName === 'signals') {
    fetchSignals();
  }
}

// Startup Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Init side menu
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', handleTabChange);
  });
  
  // Init competitor modal actions
  document.getElementById('add-competitor-btn').addEventListener('click', () => openCompetitorModal());
  document.getElementById('close-modal-btn').addEventListener('click', closeCompetitorModal);
  document.getElementById('cancel-modal-btn').addEventListener('click', closeCompetitorModal);
  document.getElementById('competitor-form').addEventListener('submit', saveCompetitor);
  
  // Init configuration actions
  document.getElementById('config-form').addEventListener('submit', handleConfigFormSubmit);
  
  // Init run scraper action
  document.getElementById('run-scraper-btn').addEventListener('click', triggerScraperRun);
  
  // Init refresh signals grid
  document.getElementById('refresh-signals-btn').addEventListener('click', fetchSignals);
  
  // Initial API loads
  fetchConfig();
  fetchReports();
  
  // Setup polling for scraper run progress check (every 5 seconds)
  checkScraperStatus();
  setInterval(checkScraperStatus, 5000);
  
  initIcons();
});
