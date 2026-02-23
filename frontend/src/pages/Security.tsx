import React, { useState } from 'react';
import { Shield, Info, AlertCircle, Download, FileText, Printer } from 'lucide-react';

interface Vulnerability {
  id: string;
  severity: string;
  title: string;
  description: string;
  package: string;
  version: string;
  fixed_in: string;
  url: string;
}

interface ScanResult {
  image_name: string;
  scan_date: string;
  total_vulns: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  vulnerabilities: Vulnerability[];
  recommendations: string[];
  trivy_available: boolean;
}

export const Security: React.FC = () => {
  const [scanResults, setScanResults] = useState<Record<string, ScanResult>>({});
  const [scanning, setScanning] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const scanAllContainers = async () => {
    setScanning(true);
    try {
      const response = await fetch('/api/security/scan/all', { method: 'POST' });
      const data = await response.json();
      setScanResults(data);
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setScanning(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const totalVulns = Object.values(scanResults).reduce((sum, r) => sum + r.total_vulns, 0);
  const criticalCount = Object.values(scanResults).reduce((sum, r) => sum + r.critical, 0);
  const highCount = Object.values(scanResults).reduce((sum, r) => sum + r.high, 0);

  const exportToJSON = () => {
    const data = JSON.stringify(scanResults, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-scan-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    const rows = [['Image', 'Critical', 'High', 'Medium', 'Low', 'Total', 'Scan Date']];
    Object.entries(scanResults).forEach(([img, result]) => {
      rows.push([
        img,
        result.critical.toString(),
        result.high.toString(),
        result.medium.toString(),
        result.low.toString(),
        result.total_vulns.toString(),
        result.scan_date
      ]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-scan-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const reportContent = generateHTMLReport();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const generateHTMLReport = () => {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Security Audit Report - ${new Date().toLocaleDateString()}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #7c3aed; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .card { padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; }
    .critical { background: #fef2f2; color: #991b1b; }
    .high { background: #fff7ed; color: #9a3412; }
    .medium { background: #fefce8; color: #854d0e; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; font-weight: 600; }
    .severity { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <h1>🛡️ Security Audit Report</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>
  
  <div class="summary">
    <div class="card"><strong>Total Vulnerabilities:</strong> ${totalVulns}</div>
    <div class="card critical"><strong>Critical:</strong> ${criticalCount}</div>
    <div class="card high"><strong>High:</strong> ${highCount}</div>
    <div class="card"><strong>Images Scanned:</strong> ${Object.keys(scanResults).length}</div>
  </div>

  ${Object.entries(scanResults).map(([img, result]) => `
    <h2>${img}</h2>
    <table>
      <tr>
        <th>Severity</th>
        <th>Count</th>
        <th>Scan Date</th>
      </tr>
      <tr>
        <td><span class="severity critical">Critical</span></td>
        <td>${result.critical}</td>
        <td rowspan="4">${new Date(result.scan_date).toLocaleString()}</td>
      </tr>
      <tr>
        <td><span class="severity high">High</span></td>
        <td>${result.high}</td>
      </tr>
      <tr>
        <td><span class="severity medium">Medium</span></td>
        <td>${result.medium}</td>
      </tr>
      <tr>
        <td><span class="severity">Low</span></td>
        <td>${result.low}</td>
      </tr>
    </table>
  `).join('')}
</body>
</html>`;
  };

  return (
    <div style={{ padding: '30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Shield size={32} color="#a855f7" />
            <h1 style={{ fontSize: '28px', fontWeight: '700' }}>Security Auditing</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Container vulnerability scanning and security analysis
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {Object.keys(scanResults).length > 0 && (
            <>
              <button
                onClick={exportToJSON}
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
              <button
                onClick={exportToCSV}
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
                CSV
              </button>
              <button
                onClick={exportToPDF}
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
                <Printer size={16} />
                Print Report
              </button>
            </>
          )}
          <button
            onClick={scanAllContainers}
            disabled={scanning}
            style={{
              padding: '10px 20px',
              background: '#a855f7',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: scanning ? 'not-allowed' : 'pointer',
              opacity: scanning ? 0.5 : 1,
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            {scanning ? 'Scanning...' : 'Scan All Containers'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px'
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Total Vulnerabilities</div>
          <div style={{ fontSize: '32px', fontWeight: '700' }}>{totalVulns}</div>
        </div>
        <div style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          border: '2px solid #ef4444',
          borderRadius: '12px'
        }}>
          <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '8px' }}>Critical</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#ef4444' }}>{criticalCount}</div>
        </div>
        <div style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          border: '2px solid #f59e0b',
          borderRadius: '12px'
        }}>
          <div style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '8px' }}>High</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#f59e0b' }}>{highCount}</div>
        </div>
        <div style={{
          padding: '20px',
          background: 'var(--bg-secondary)',
          border: '2px solid #10b981',
          borderRadius: '12px'
        }}>
          <div style={{ fontSize: '12px', color: '#10b981', marginBottom: '8px' }}>Images Scanned</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#10b981' }}>{Object.keys(scanResults).length}</div>
        </div>
      </div>

      {/* Scan Results */}
      <div className="space-y-4">
        {Object.entries(scanResults).map(([image, result]) => (
          <div key={image} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{result.image_name}</h3>
                <p className="text-sm text-gray-600">
                  Scanned: {new Date(result.scan_date).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                {result.critical > 0 && (
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                    {result.critical} Critical
                  </span>
                )}
                {result.high > 0 && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                    {result.high} High
                  </span>
                )}
                {result.medium > 0 && (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                    {result.medium} Medium
                  </span>
                )}
              </div>
            </div>

            {!result.trivy_available && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-blue-900">Trivy not installed</p>
                  <p className="text-blue-700">Install Trivy for vulnerability scanning</p>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Hardening Recommendations
                </h4>
                <ul className="space-y-1">
                  {result.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-sm text-gray-700 pl-4 border-l-2 border-gray-300">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Vulnerabilities */}
            {result.vulnerabilities.length > 0 && (
              <div>
                <button
                  onClick={() => setSelectedImage(selectedImage === image ? null : image)}
                  className="text-sm text-purple-600 hover:underline mb-2"
                >
                  {selectedImage === image ? 'Hide' : 'Show'} {result.vulnerabilities.length} vulnerabilities
                </button>
                
                {selectedImage === image && (
                  <div className="space-y-2 mt-2">
                    {result.vulnerabilities.slice(0, 10).map((vuln, idx) => (
                      <div key={idx} className="border rounded p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(vuln.severity)}`}>
                                {vuln.severity.toUpperCase()}
                              </span>
                              <span className="font-mono text-sm">{vuln.id}</span>
                            </div>
                            <h5 className="font-semibold text-sm">{vuln.title}</h5>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{vuln.description}</p>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Package:</span>
                            <span className="font-mono ml-1">{vuln.package}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Version:</span>
                            <span className="font-mono ml-1">{vuln.version}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Fixed in:</span>
                            <span className="font-mono ml-1">{vuln.fixed_in || 'N/A'}</span>
                          </div>
                        </div>
                        {vuln.url && (
                          <a
                            href={vuln.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-purple-600 hover:underline mt-1 inline-block"
                          >
                            More info →
                          </a>
                        )}
                      </div>
                    ))}
                    {result.vulnerabilities.length > 10 && (
                      <p className="text-sm text-gray-600 text-center">
                        ...and {result.vulnerabilities.length - 10} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {Object.keys(scanResults).length === 0 && !scanning && (
        <div className="text-center py-12 text-gray-500">
          <Shield className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No scan results yet. Click "Scan All Containers" to begin.</p>
        </div>
      )}
    </div>
  );
};
