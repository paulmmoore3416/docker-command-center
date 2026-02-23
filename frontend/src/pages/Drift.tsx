import React, { useState, useEffect } from 'react';
import { GitBranch, AlertTriangle, CheckCircle } from 'lucide-react';

interface DriftItem {
  container_id: string;
  container_name: string;
  field: string;
  expected: string;
  actual: string;
  severity: string;
  timestamp: string;
}

interface DriftReport {
  container_id: string;
  has_drift: boolean;
  drift_count: number;
  items: DriftItem[];
}

export const Drift: React.FC = () => {
  const [drifts, setDrifts] = useState<Record<string, DriftReport>>({});

  useEffect(() => {
    loadDrifts();
    const interval = setInterval(loadDrifts, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadDrifts = async () => {
    try {
      const response = await fetch('/api/drift');
      const data = await response.json();
      setDrifts(data || {});
    } catch (error) {
      console.error('Failed to load drifts:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default: return 'bg-blue-100 text-blue-700 border-blue-300';
    }
  };

  const totalDrifts = Object.values(drifts).reduce((sum, d) => sum + d.drift_count, 0);
  const criticalDrifts = Object.values(drifts).flatMap(d => d.items).filter(i => i.severity === 'critical').length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GitBranch className="w-8 h-8 text-indigo-500" />
          <h1 className="text-2xl font-bold">Drift Detection</h1>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-white rounded-lg shadow">
            <div className="text-xs text-gray-600">Total Drifts</div>
            <div className="text-xl font-bold">{totalDrifts}</div>
          </div>
          <div className="px-4 py-2 bg-red-50 rounded-lg shadow">
            <div className="text-xs text-red-600">Critical</div>
            <div className="text-xl font-bold text-red-700">{criticalDrifts}</div>
          </div>
        </div>
      </div>

      {Object.keys(drifts).length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Drift Detected</h3>
          <p className="text-gray-600">
            All containers match their docker-compose.yml configurations
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(drifts).map(([containerId, report]) => (
            <div key={containerId} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {report.items[0]?.container_name || containerId}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {report.drift_count} configuration difference{report.drift_count !== 1 ? 's' : ''} detected
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 font-mono">{containerId}</span>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {report.items.map((item, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-lg p-3 ${getSeverityColor(item.severity)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{item.field}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(item.severity)}`}>
                            {item.severity.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs opacity-75">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-medium mb-1">Expected (compose file):</div>
                        <code className="block bg-white bg-opacity-50 px-2 py-1 rounded font-mono text-xs break-all">
                          {item.expected}
                        </code>
                      </div>
                      <div>
                        <div className="font-medium mb-1">Actual (running container):</div>
                        <code className="block bg-white bg-opacity-50 px-2 py-1 rounded font-mono text-xs break-all">
                          {item.actual}
                        </code>
                      </div>
                    </div>

                    {item.severity === 'critical' && (
                      <div className="mt-2 text-sm font-medium">
                        ⚠️ This is a security concern that should be addressed immediately
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 border-t px-4 py-3 flex justify-end gap-2">
                <button className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                  View Compose File
                </button>
                <button className="px-4 py-2 text-sm text-white bg-indigo-600 rounded hover:bg-indigo-700">
                  Recreate Container
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">About Drift Detection</h4>
        <p className="text-sm text-blue-800">
          Drift detection compares running containers with their docker-compose.yml definitions.
          It checks for differences in images, environment variables, users, and other configurations.
          This helps ensure your containers match your intended configuration and haven't been
          manually modified.
        </p>
      </div>
    </div>
  );
};
