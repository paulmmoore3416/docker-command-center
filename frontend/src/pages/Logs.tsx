import React, { useState, useEffect, useMemo } from 'react';
import { Terminal, Search, Filter, Bell, Download, FileText, Copy } from 'lucide-react';
import { List, RowComponentProps } from 'react-window';

interface LogEntry {
  timestamp: string;
  container_id: string;
  container_name: string;
  level: string;
  message: string;
  raw: string;
}

interface WatchWord {
  pattern: string;
  is_regex: boolean;
  description: string;
  severity: string;
}

export const Logs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [containerFilter, setContainerFilter] = useState('');
  const [watchwords, setWatchwords] = useState<WatchWord[]>([]);
  const [newWatchword, setNewWatchword] = useState('');

  useEffect(() => {
    loadLogs();
    loadWatchwords();
    const interval = setInterval(loadLogs, 3000);
    return () => clearInterval(interval);
  }, [containerFilter, levelFilter, filter]);

  const loadLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (containerFilter) params.append('container_id', containerFilter);
      if (levelFilter) params.append('level', levelFilter);
      if (filter) params.append('search', filter);
      params.append('tail', '200');

      const response = await fetch(`/api/logs/aggregated?${params}`);
      const data = await response.json();
      setLogs(data.entries || []);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  const loadWatchwords = async () => {
    try {
      const response = await fetch('/api/logs/watchwords');
      const data = await response.json();
      setWatchwords(data || []);
    } catch (error) {
      console.error('Failed to load watchwords:', error);
    }
  };

  const addWatchword = async () => {
    if (!newWatchword.trim()) return;

    try {
      await fetch('/api/logs/watchwords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: newWatchword,
          is_regex: false,
          description: `Watch for: ${newWatchword}`,
          severity: 'medium',
        }),
      });
      setNewWatchword('');
      loadWatchwords();
    } catch (error) {
      console.error('Failed to add watchword:', error);
    }
  };

  const containerOptions = Array.from(
    new Map(logs.map(l => [l.container_id, l.container_name])).entries()
  );
  const rowData = useMemo(() => logs, [logs]);

  const exportLogsToJSON = () => {
    const data = JSON.stringify(logs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportLogsToText = () => {
    const text = logs.map(log => 
      `${log.timestamp} [${log.container_name}] ${log.level.toUpperCase()}: ${log.message}`
    ).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyLogsToClipboard = () => {
    const text = logs.map(log => 
      `${log.timestamp} [${log.container_name}] ${log.level.toUpperCase()}: ${log.message}`
    ).join('\n');
    navigator.clipboard.writeText(text);
  };

  const Row = ({ index, style }: RowComponentProps) => {
    const log = rowData[index];
    return (
      <div style={{
        ...style,
        padding: '8px 12px',
        borderRadius: '6px',
        background: 'rgba(30, 41, 59, 0.4)',
        marginBottom: '4px',
        borderLeft: `3px solid ${
          log.level === 'error' || log.level === 'fatal' ? '#ef4444' :
          log.level === 'warning' ? '#f59e0b' :
          log.level === 'info' ? '#3b82f6' :
          '#64748b'
        }`,
        transition: 'background 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(30, 41, 59, 0.4)'}
      >
        <span style={{ color: '#94a3b8', fontSize: '12px', fontFamily: 'monospace' }}>
          {new Date(log.timestamp).toLocaleTimeString()}
        </span>
        <span style={{ color: '#60a5fa', marginLeft: '12px', fontSize: '13px' }}>[{log.container_name}]</span>
        <span style={{
          marginLeft: '12px',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: '600',
          background: log.level === 'error' || log.level === 'fatal' ? '#7f1d1d' :
                     log.level === 'warning' ? '#78350f' :
                     log.level === 'info' ? '#1e3a8a' :
                     '#1e293b',
          color: log.level === 'error' || log.level === 'fatal' ? '#fca5a5' :
                log.level === 'warning' ? '#fcd34d' :
                log.level === 'info' ? '#93c5fd' :
                '#94a3b8'
        }}>
          {log.level.toUpperCase()}
        </span>
        <span style={{ color: '#e2e8f0', marginLeft: '12px', fontSize: '13px' }}>{log.message}</span>
      </div>
    );
  };

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Terminal size={32} color="#10b981" />
            <h1 style={{ fontSize: '28px', fontWeight: '700' }}>Log Aggregation</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {logs.length} log entries
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {logs.length > 0 && (
            <>
              <button
                onClick={copyLogsToClipboard}
                style={{
                  padding: '8px 16px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '14px'
                }}
              >
                <Copy size={16} />
                Copy
              </button>
              <button
                onClick={exportLogsToText}
                style={{
                  padding: '8px 16px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '14px'
                }}
              >
                <FileText size={16} />
                TXT
              </button>
              <button
                onClick={exportLogsToJSON}
                style={{
                  padding: '8px 16px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '14px'
                }}
              >
                <Download size={16} />
                JSON
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Search className="w-4 h-4 inline mr-1" />
              Search
            </label>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="grep pattern..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Filter className="w-4 h-4 inline mr-1" />
              Container
            </label>
            <select
              value={containerFilter}
              onChange={(e) => setContainerFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">All containers</option>
              {containerOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Level
            </label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">All levels</option>
              <option value="fatal">Fatal</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>
        </div>
      </div>

      {/* Watchwords */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Bell className="w-5 h-5 text-green-600" />
          Watchwords (Auto-Alerts)
        </h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newWatchword}
            onChange={(e) => setNewWatchword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addWatchword()}
            placeholder="Add watchword to monitor..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={addWatchword}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {watchwords.map((ww, idx) => (
            <span
              key={idx}
              className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${
                ww.severity === 'critical' ? 'bg-red-100 text-red-700' :
                ww.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                'bg-yellow-100 text-yellow-700'
              }`}
            >
              {ww.pattern}
            </span>
          ))}
        </div>
      </div>

      {/* Logs */}
      <div className="bg-gray-900 rounded-lg shadow p-4 font-mono text-sm">
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No logs matching filters</div>
        ) : (
          <List
            defaultHeight={520}
            rowCount={rowData.length}
            rowHeight={28}
            rowComponent={Row}
            rowProps={{}}
            style={{ width: '100%', height: 520 }}
          />
        )}
      </div>
    </div>
  );
};
