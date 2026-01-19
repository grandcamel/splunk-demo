/**
 * Scenario rendering routes.
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const DOMPurify = require('isomorphic-dompurify');
const config = require('../config');

/**
 * Check if a file path is safely within the base directory.
 * Uses path.relative() for more robust path traversal protection.
 * @param {string} filePath - The file path to validate
 * @param {string} basePath - The base directory that should contain the file
 * @returns {boolean} True if filePath is within basePath
 */
function isPathWithinBase(filePath, basePath) {
  const resolvedPath = path.resolve(filePath);
  const resolvedBase = path.resolve(basePath);
  const relative = path.relative(resolvedBase, resolvedPath);

  // Reject if path escapes base (starts with ..) or is absolute
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Register scenario routes.
 * @param {Express} app - Express application
 */
function register(app) {
  app.get('/api/scenarios/:name', (req, res) => {
    const scenarioName = req.params.name;
    const scenario = config.SCENARIO_NAMES[scenarioName];

    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const filePath = path.join(config.SCENARIOS_PATH, scenario.file);

    // Path traversal protection: ensure resolved path is within SCENARIOS_PATH
    if (!isPathWithinBase(filePath, config.SCENARIOS_PATH)) {
      console.error(`Path traversal attempt blocked: ${filePath}`);
      return res.status(400).json({ error: 'Invalid path' });
    }

    const resolvedPath = path.resolve(filePath);
    fs.readFile(resolvedPath, 'utf8', (err, markdown) => {
      if (err) {
        console.error(`Error reading scenario ${scenarioName}:`, err);
        return res.status(404).json({ error: 'Scenario file not found' });
      }

      const htmlContent = DOMPurify.sanitize(marked(markdown));

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${scenario.icon} ${scenario.title} - Splunk Assistant Skills</title>
  <style>
    :root {
      --deep-navy: #1a1a2e;
      --dark-blue: #16213e;
      --splunk-green: #65A637;
      --cyan: #00C7E6;
      --light-gray: #e2e8f0;
      --muted-gray: #94a3b8;
      --white: #ffffff;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, var(--deep-navy) 0%, var(--dark-blue) 100%);
      color: var(--light-gray);
      min-height: 100vh;
      line-height: 1.7;
    }
    header {
      background: rgba(26, 26, 46, 0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding: 1rem 2rem;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    header a {
      color: var(--muted-gray);
      text-decoration: none;
      font-size: 0.9rem;
    }
    header a:hover { color: var(--white); }
    .header-content {
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--white);
    }
    main {
      max-width: 900px;
      margin: 0 auto;
      padding: 3rem 2rem;
    }
    h1 { font-size: 2rem; margin-bottom: 1.5rem; color: var(--white); }
    h2 { font-size: 1.5rem; margin: 2rem 0 1rem; color: var(--white); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; }
    h3 { font-size: 1.2rem; margin: 1.5rem 0 0.75rem; color: var(--splunk-green); }
    p { margin: 1rem 0; }
    ul, ol { margin: 1rem 0 1rem 1.5rem; }
    li { margin: 0.5rem 0; }
    code {
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      background: rgba(0, 0, 0, 0.3);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-size: 0.9em;
      color: var(--splunk-green);
    }
    pre {
      background: rgba(0, 0, 0, 0.4);
      padding: 1rem 1.5rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1rem 0;
      border-left: 3px solid var(--splunk-green);
    }
    pre code {
      background: none;
      padding: 0;
      color: var(--light-gray);
    }
    blockquote {
      border-left: 3px solid var(--cyan);
      padding-left: 1rem;
      margin: 1rem 0;
      color: var(--muted-gray);
      font-style: italic;
    }
    a { color: var(--cyan); }
    a:hover { color: var(--white); }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    th, td {
      border: 1px solid rgba(255,255,255,0.1);
      padding: 0.75rem;
      text-align: left;
    }
    th { background: rgba(101, 166, 55, 0.2); color: var(--white); }
    tr:nth-child(even) { background: rgba(255,255,255,0.02); }
    hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 2rem 0; }
    .nav-links { display: flex; gap: 1.5rem; flex-wrap: wrap; }
  </style>
</head>
<body>
  <header>
    <div class="header-content">
      <span class="header-title">${scenario.icon} ${scenario.title}</span>
      <nav class="nav-links">
        <a href="/scenarios/devops">🔧 DevOps</a>
        <a href="/scenarios/sre">🚨 SRE</a>
        <a href="/scenarios/support">🎧 Support</a>
        <a href="/scenarios/management">📊 Mgmt</a>
        <a href="/scenarios/search">🔍 Search</a>
      </nav>
    </div>
  </header>
  <main>
    ${htmlContent}
  </main>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    });
  });
}

module.exports = { register };
