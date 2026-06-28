const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { exec } = require('child_process');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const workflowFilePath = path.join(__dirname, 'existing_workflow.json');
const n8nCliPath = 'C:\\Users\\aishw\\AppData\\Roaming\\npm\\node_modules\\n8n\\bin\\n8n';
const reportsDir = path.join(__dirname, 'reports');

// Create reports directory if it doesn't exist
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir);
}

// Helper: Extract config variables from existing_workflow.json using VM sandbox
function getConfigFromWorkflow() {
  if (!fs.existsSync(workflowFilePath)) {
    throw new Error('existing_workflow.json not found');
  }
  const wf = JSON.parse(fs.readFileSync(workflowFilePath, 'utf8'));
  const nodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : wf.nodes;
  const configNode = nodes.find(n => n.name === 'Define Config');
  if (!configNode) {
    throw new Error('"Define Config" node not found in workflow');
  }
  
  const jsCode = configNode.parameters.jsCode;
  
  // Wrap jsCode to capture the return value in a VM context
  const sandbox = {};
  const scriptText = `
    function run() {
      ${jsCode}
    }
    const result = run();
    outputs = result[0].json;
  `;
  
  const script = new vm.Script(scriptText);
  const context = vm.createContext(sandbox);
  script.runInContext(context);
  
  return sandbox.outputs;
}

// Helper: Save config updates back to existing_workflow.json and trigger import
function saveConfigToWorkflow(config, callback) {
  try {
    const wf = JSON.parse(fs.readFileSync(workflowFilePath, 'utf8'));
    let nodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : wf.nodes;
    const configNodeIndex = nodes.findIndex(n => n.name === 'Define Config');
    if (configNodeIndex === -1) {
      return callback(new Error('"Define Config" node not found'));
    }

    const newJsCode = `const targetCompany = ${JSON.stringify(config.targetCompany, null, 2)};

const competitors = ${JSON.stringify(config.competitors, null, 2)};

const analysisContext = ${JSON.stringify(config.analysisContext)};

const analyzerSystemPrompt = ${JSON.stringify(config.analyzerSystemPrompt)};

const reportSystemPrompt = ${JSON.stringify(config.reportSystemPrompt)};

return [{ json: {
  targetCompany,
  competitors,
  analysisContext,
  analyzerSystemPrompt,
  reportSystemPrompt,
  groqApiKey: ${JSON.stringify(config.groqApiKey)},
  pagespeedApiKey: ${JSON.stringify(config.pagespeedApiKey)}
} }];`;

    nodes[configNodeIndex].parameters.jsCode = newJsCode;
    wf.nodes = nodes;
    
    fs.writeFileSync(workflowFilePath, JSON.stringify(wf, null, 2), 'utf8');

    // Run import to synchronize with n8n DB
    exec(`node "${n8nCliPath}" import:workflow --input="${workflowFilePath}"`, (err, stdout, stderr) => {
      if (err) {
        console.error('n8n import failed:', stderr);
        return callback(err);
      }
      console.log('Successfully imported updated configuration to n8n database');
      callback(null);
    });
  } catch (err) {
    callback(err);
  }
}

// API: Get active configuration
app.get('/api/config', (req, res) => {
  try {
    const config = getConfigFromWorkflow();
    res.json(config);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: Save configuration
app.post('/api/config', (req, res) => {
  const newConfig = req.body;
  if (!newConfig.competitors || !newConfig.targetCompany || !newConfig.analysisContext || !newConfig.analyzerSystemPrompt || !newConfig.reportSystemPrompt) {
    return res.status(400).json({ error: 'Invalid configuration parameters' });
  }

  saveConfigToWorkflow(newConfig, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, message: 'Configuration saved and synced successfully' });
  });
});

// API: Get reports history
app.get('/api/reports', (req, res) => {
  fs.readdir(reportsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read reports directory' });
    }
    
    const htmlFiles = files
      .filter(f => f.endsWith('.html'))
      .map(f => {
        const stats = fs.statSync(path.join(reportsDir, f));
        return {
          filename: f,
          createdTime: stats.mtime,
          sizeBytes: stats.size
        };
      })
      .sort((a, b) => b.createdTime - a.createdTime); // Sort newest first
      
    res.json(htmlFiles);
  });
});

// API: Get specific report contents
app.get('/api/reports/:filename', (req, res) => {
  const filename = req.params.filename;
  // Prevent directory traversal attacks
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const reportPath = path.join(reportsDir, filename);
  if (!fs.existsSync(reportPath)) {
    return res.status(404).json({ error: 'Report not found' });
  }
  
  res.sendFile(reportPath);
});

// API: Trigger execution
let activeProcess = null;
app.post('/api/run', (req, res) => {
  if (activeProcess) {
    return res.status(400).json({ error: 'An analysis run is already in progress.' });
  }

  res.json({ message: 'Scraper execution started in background' });

  console.log('Triggering competitor analysis scraper...');
  const childEnv = {
    ...process.env,
    N8N_RUNNERS_BROKER_PORT: '5699',
    N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'false',
    N8N_RESTRICT_FILE_ACCESS_TO: __dirname
  };

  activeProcess = exec(`node "${n8nCliPath}" execute --id=P4bBNPzkRmQCXVHl`, { env: childEnv, cwd: __dirname }, (err, stdout, stderr) => {
    activeProcess = null;
    const combinedOutput = (stdout || '') + '\n' + (stderr || '');
    
    try {
      const startIndex = combinedOutput.indexOf('{');
      const lastIndex = combinedOutput.lastIndexOf('}');
      if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
        const jsonText = combinedOutput.substring(startIndex, lastIndex + 1);
        const executionData = JSON.parse(jsonText);
        const runData = executionData.data.resultData.runData;
        const buildEmailRun = runData['Build Email'];
        
        if (buildEmailRun && buildEmailRun.length > 0) {
          const htmlBody = buildEmailRun[0].data.main[0][0].json.htmlBody;
          if (htmlBody) {
            const reportPath = path.join(__dirname, 'competitor_analysis_report.html');
            fs.writeFileSync(reportPath, htmlBody, 'utf8');
            console.log('Successfully extracted HTML report from execution data');
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const archivePath = path.join(reportsDir, `report_${timestamp}.html`);
            fs.writeFileSync(archivePath, htmlBody, 'utf8');
            console.log(`Archived new report to: ${archivePath}`);

            // Extract and save signals to reports/signals.json
            const fetchCompData = runData?.['Fetch Competitor Data'];
            if (fetchCompData && fetchCompData.length > 0) {
              const items = [];
              fetchCompData.forEach(run => {
                if (run?.data?.main?.[0]) {
                  run.data.main[0].forEach(item => {
                    if (item?.json) {
                      items.push({
                        competitorName: item.json.competitorName,
                        signals: item.json.competitorSignals
                      });
                    }
                  });
                }
              });
              if (items.length > 0) {
                const signalsPath = path.join(reportsDir, 'signals.json');
                fs.writeFileSync(signalsPath, JSON.stringify(items, null, 2), 'utf8');
                console.log('Successfully saved signals.json');
              }
            }
            return;
          }
        }
      }
    } catch (e) {
      console.error('Failed to extract report from n8n output:', e.message);
    }
    
    if (err) {
      console.error('n8n execution failed:', stderr || stdout);
    } else {
      console.error('Report file was not generated by n8n workflow');
    }
  });
});

// API: Check run status
app.get('/api/status', (req, res) => {
  res.json({ running: !!activeProcess });
});

// API: Get latest extracted signals
app.get('/api/signals', (req, res) => {
  const signalsPath = path.join(reportsDir, 'signals.json');
  if (fs.existsSync(signalsPath)) {
    try {
      const content = fs.readFileSync(signalsPath, 'utf8');
      return res.json(JSON.parse(content));
    } catch (e) {
      console.error('Error reading signals.json:', e);
    }
  }
  res.json([]);
});

// Fallback to index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Competitor Dashboard server running at http://localhost:${port}`);
});
