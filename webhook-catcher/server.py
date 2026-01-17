#!/usr/bin/env python3
"""
Webhook Catcher - Receives and displays Splunk alert webhooks.

Provides a simple UI to view triggered alerts during the demo.
"""

import json
import os
from datetime import datetime
from collections import deque

from flask import Flask, request, jsonify, render_template_string

app = Flask(__name__)

# Store recent webhooks (max 100)
webhooks = deque(maxlen=100)

HTML_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>Splunk Alert Webhooks</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            color: #eee;
            padding: 20px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #333;
        }
        h1 { color: #00d4aa; }
        .stats {
            display: flex;
            gap: 20px;
        }
        .stat {
            background: #16213e;
            padding: 10px 20px;
            border-radius: 8px;
        }
        .stat-value { font-size: 24px; font-weight: bold; color: #00d4aa; }
        .stat-label { font-size: 12px; color: #888; }
        .webhook-list { display: flex; flex-direction: column; gap: 10px; }
        .webhook {
            background: #16213e;
            border-radius: 8px;
            padding: 15px;
            border-left: 4px solid #00d4aa;
        }
        .webhook.error { border-left-color: #ff6b6b; }
        .webhook.warning { border-left-color: #ffd93d; }
        .webhook-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        .webhook-title { font-weight: bold; font-size: 16px; }
        .webhook-time { color: #888; font-size: 12px; }
        .webhook-details { font-size: 14px; color: #aaa; }
        .webhook-payload {
            margin-top: 10px;
            padding: 10px;
            background: #0f0f23;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            overflow-x: auto;
            display: none;
        }
        .webhook:hover .webhook-payload { display: block; }
        .empty {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        .refresh-btn {
            background: #00d4aa;
            color: #1a1a2e;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        }
        .refresh-btn:hover { background: #00b894; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔔 Splunk Alert Webhooks</h1>
        <div class="stats">
            <div class="stat">
                <div class="stat-value">{{ webhooks|length }}</div>
                <div class="stat-label">Total Alerts</div>
            </div>
            <button class="refresh-btn" onclick="location.reload()">Refresh</button>
        </div>
    </div>

    <div class="webhook-list">
        {% if webhooks %}
            {% for webhook in webhooks|reverse %}
            <div class="webhook {{ 'error' if 'critical' in (webhook.data.get('severity', '')|lower) or 'error' in (webhook.data.get('search_name', '')|lower) else 'warning' if 'warning' in (webhook.data.get('severity', '')|lower) else '' }}">
                <div class="webhook-header">
                    <div class="webhook-title">{{ webhook.data.get('search_name', webhook.data.get('alert_name', 'Unknown Alert')) }}</div>
                    <div class="webhook-time">{{ webhook.timestamp }}</div>
                </div>
                <div class="webhook-details">
                    {% if webhook.data.get('result') %}
                        <strong>Result:</strong> {{ webhook.data.get('result') | tojson }}
                    {% elif webhook.data.get('results_link') %}
                        <strong>Results:</strong> <a href="{{ webhook.data.get('results_link') }}" style="color: #00d4aa;">View in Splunk</a>
                    {% else %}
                        <strong>Source:</strong> {{ webhook.source }}
                    {% endif %}
                </div>
                <div class="webhook-payload">{{ webhook.data | tojson(indent=2) }}</div>
            </div>
            {% endfor %}
        {% else %}
            <div class="empty">
                <p>No alerts received yet.</p>
                <p style="margin-top: 10px;">Alerts will appear here when Splunk triggers webhook actions.</p>
            </div>
        {% endif %}
    </div>

    <script>
        // Auto-refresh every 10 seconds
        setTimeout(() => location.reload(), 10000);
    </script>
</body>
</html>
'''


@app.route('/')
def index():
    """Display webhook UI."""
    return render_template_string(HTML_TEMPLATE, webhooks=list(webhooks))


@app.route('/webhook', methods=['POST'])
@app.route('/webhooks', methods=['POST'])
@app.route('/alert', methods=['POST'])
def receive_webhook():
    """Receive webhook from Splunk."""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    try:
        data = request.get_json(force=True)
    except Exception:
        data = dict(request.form) or {'raw': request.data.decode('utf-8', errors='ignore')}

    webhook_entry = {
        'timestamp': timestamp,
        'source': request.remote_addr,
        'path': request.path,
        'data': data
    }

    webhooks.append(webhook_entry)
    print(f"[{timestamp}] Received webhook from {request.remote_addr}: {json.dumps(data)[:200]}")

    return jsonify({'status': 'received', 'timestamp': timestamp})


@app.route('/health')
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'webhooks_count': len(webhooks)})


@app.route('/api/webhooks')
def api_webhooks():
    """API endpoint to get webhooks as JSON."""
    return jsonify(list(webhooks))


@app.route('/clear', methods=['POST'])
def clear_webhooks():
    """Clear all stored webhooks."""
    webhooks.clear()
    return jsonify({'status': 'cleared'})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Webhook catcher starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
