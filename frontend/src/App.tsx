import React, { useState } from 'react';

interface AnalysisResult {
  total_grains: number;
  good_grains: number;
  broken_grains: number;
  foreign_matter: number;
  chalky_grains: number;
  avg_grain_length_mm: number;
  avg_grain_width_mm: number;
  note: string;
}

const RiceGuardApp: React.FC = () => {
  const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [results, setResults] = useState<AnalysisResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      setResults(null);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let detail = '';
        const requestId = response.headers.get('x-request-id') || '';
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const body = await response.json();
            if (body && typeof body === 'object' && 'detail' in body) {
              const d = (body as any).detail;
              detail = typeof d === 'string' ? d : JSON.stringify(d);
            } else {
              detail = JSON.stringify(body);
            }
          } else {
            detail = await response.text();
          }
        } catch {
          // ignore parsing errors
        }

        const idSuffix = requestId ? ` (request_id: ${requestId})` : '';
        const suffix = detail ? `: ${detail}${idSuffix}` : idSuffix;
        throw new Error(`Analysis failed (${response.status})${suffix}`);
      }

      const data: AnalysisResult = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview('');
    setResults(null);
    setError('');
  };

  return (
    <div className="app">
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: #fafafa;
          color: #1f1f1f;
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .app {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* Header */
        .header {
          background: #ffffff;
          border-bottom: 1px solid #e0e0e0;
          padding: 0 32px;
          height: 64px;
          display: flex;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 1px 0 rgba(0,0,0,0.05);
        }

        .header-content {
          max-width: 1440px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .brand {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }

        .brand-main {
          font-size: 20px;
          font-weight: 600;
          color: #1f1f1f;
          letter-spacing: -0.3px;
        }

        .brand-sub {
          font-size: 14px;
          font-weight: 400;
          color: #757575;
        }

        .powered-by {
          font-size: 13px;
          color: #757575;
          font-weight: 400;
        }

        /* Main Content */
        .main {
          flex: 1;
          max-width: 1440px;
          width: 100%;
          margin: 0 auto;
          padding: 48px 32px;
        }

        .page-title {
          font-size: 28px;
          font-weight: 600;
          color: #1f1f1f;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }

        .page-subtitle {
          font-size: 15px;
          color: #757575;
          margin-bottom: 32px;
        }

        .upload-section {
          background: #ffffff;
          border-radius: 8px;
          padding: 40px;
          border: 1px solid #e0e0e0;
          margin-bottom: 32px;
        }

        .section-label {
          font-size: 14px;
          font-weight: 500;
          color: #1f1f1f;
          margin-bottom: 16px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .upload-area {
          border: 2px dashed #d0d0d0;
          border-radius: 4px;
          padding: 64px 32px;
          text-align: center;
          cursor: pointer;
          transition: all 0.15s ease;
          background: #fafafa;
        }

        .upload-area:hover {
          border-color: #4285f4;
          background: #f8f9fd;
        }

        .upload-area.has-file {
          border-color: #4285f4;
          background: #f8f9fd;
        }

        .upload-icon {
          width: 48px;
          height: 48px;
          margin: 0 auto 20px;
          background: #f0f0f0;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #757575;
          font-size: 20px;
        }

        .upload-text {
          font-size: 15px;
          color: #1f1f1f;
          font-weight: 500;
          margin-bottom: 8px;
        }

        .upload-hint {
          font-size: 13px;
          color: #757575;
        }

        .preview-container {
          margin-top: 24px;
          text-align: center;
        }

        .preview-image {
          max-width: 100%;
          max-height: 320px;
          border-radius: 4px;
          border: 1px solid #e0e0e0;
        }

        .file-name {
          font-size: 13px;
          color: #757575;
          margin-top: 12px;
        }

        .actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
          justify-content: center;
        }

        .btn {
          height: 36px;
          padding: 0 24px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: all 0.15s ease;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .btn-primary {
          background: #1a73e8;
          color: #ffffff;
        }

        .btn-primary:hover:not(:disabled) {
          background: #1765cc;
          box-shadow: 0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15);
        }

        .btn-primary:active:not(:disabled) {
          background: #1557b0;
        }

        .btn-primary:disabled {
          background: #f0f0f0;
          color: #9e9e9e;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #ffffff;
          color: #1a73e8;
          border: 1px solid #d0d0d0;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #f8f9fa;
          border-color: #1a73e8;
        }

        input[type="file"] {
          display: none;
        }

        /* Loading */
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.96);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .loading-content {
          text-align: center;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e0e0e0;
          border-top-color: #1a73e8;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .loading-text {
          font-size: 14px;
          color: #757575;
        }

        /* Error */
        .error-banner {
          background: #fce8e6;
          border-left: 4px solid #d93025;
          border-radius: 0;
          padding: 16px 20px;
          margin-bottom: 32px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .error-icon {
          color: #d93025;
          font-size: 18px;
          margin-top: 2px;
        }

        .error-text {
          color: #5f6368;
          font-size: 14px;
          line-height: 1.5;
        }

        /* Results */
        .results-section {
          animation: fadeIn 0.25s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .results-header {
          font-size: 20px;
          font-weight: 600;
          color: #1f1f1f;
          margin-bottom: 24px;
          letter-spacing: -0.3px;
        }

        .results-container {
          display: grid;
          grid-template-columns: 1fr;
          gap: 32px;
          margin-bottom: 32px;
        }

        /* Results Table */
        .results-table {
          background: #ffffff;
          border-radius: 4px;
          border: 1px solid #e0e0e0;
          overflow: hidden;
        }

        .table-row {
          display: grid;
          grid-template-columns: 1fr 120px;
          border-bottom: 1px solid #e0e0e0;
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .table-cell {
          padding: 20px 24px;
          font-size: 14px;
        }

        .table-cell.label {
          color: #1f1f1f;
          font-weight: 500;
          background: #fafafa;
        }

        .table-cell.value {
          color: #1f1f1f;
          font-size: 20px;
          font-weight: 400;
          text-align: right;
          background: #ffffff;
        }

        .table-row.total .table-cell {
          background: #f0f7ff;
          color: #1a73e8;
          font-weight: 600;
        }

        .table-row.good .table-cell.value {
          color: #1e8e3e;
        }

        .table-row.broken .table-cell.value {
          color: #d93025;
        }

        .table-row.foreign .table-cell.value {
          color: #f9ab00;
        }

        /* Footer */
        .footer {
          background: #ffffff;
          border-top: 1px solid #e0e0e0;
          padding: 20px 32px;
          text-align: center;
        }

        .footer-text {
          font-size: 13px;
          color: #757575;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .main {
            padding: 24px 16px;
          }

          .header {
            padding: 0 16px;
          }

          .upload-section {
            padding: 24px 20px;
          }
        }

        @media (max-width: 768px) {
          .main {
            padding: 24px 16px;
          }

          .header {
            padding: 0 16px;
          }

          .upload-section {
            padding: 24px 20px;
          }

          .page-title {
            font-size: 24px;
          }
        }
      `}</style>

      {/* Header */}
      <div className="header">
        <div className="header-content">
          <div className="brand">
            <span className="brand-main">RiceGuard</span>
            <span className="brand-sub">by Quality AI</span>
          </div>
          <div className="powered-by">
            Powered by CargoFirst
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main">
        <div className="page-title">Rice Quality Analysis</div>
        <div className="page-subtitle">Upload a sample image to analyze grain quality metrics</div>

        {/* Upload Section */}
        <div className="upload-section">
          <div className="section-label">Upload Sample</div>

          <label htmlFor="fileInput">
            <div className={`upload-area ${selectedFile ? 'has-file' : ''}`}>
              <div className="upload-icon">↑</div>
              <div className="upload-text">
                {selectedFile ? 'Image ready for analysis' : 'Click to select image'}
              </div>
              <div className="upload-hint">
                Supported formats: JPG, PNG
              </div>
            </div>
          </label>
          <input
            type="file"
            id="fileInput"
            accept="image/*"
            onChange={handleFileChange}
          />

          {preview && (
            <div className="preview-container">
              <img src={preview} alt="Preview" className="preview-image" />
              <div className="file-name">{selectedFile?.name}</div>
            </div>
          )}

          {selectedFile && (
            <div className="actions">
              <button
                className="btn btn-primary"
                onClick={handleAnalyze}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Run Analysis'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleReset}
                disabled={loading}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="error-banner">
            <span className="error-icon">!</span>
            <span className="error-text">{error}</span>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="results-section">
            <div className="results-header">Analysis Results</div>

            <div className="results-container">
              {/* Results Table */}
              <div className="results-table">
                <div className="table-row total">
                  <div className="table-cell label">Total Grains</div>
                  <div className="table-cell value">{results.total_grains}</div>
                </div>

                <div className="table-row good">
                  <div className="table-cell label">Good Grains</div>
                  <div className="table-cell value">{results.good_grains}</div>
                </div>

                <div className="table-row broken">
                  <div className="table-cell label">Broken Grains</div>
                  <div className="table-cell value">{results.broken_grains}</div>
                </div>

                <div className="table-row foreign">
                  <div className="table-cell label">Foreign Matter</div>
                  <div className="table-cell value">{results.foreign_matter}</div>
                </div>

                <div className="table-row">
                  <div className="table-cell label">Chalky Grains</div>
                  <div className="table-cell value">{results.chalky_grains}</div>
                </div>

                <div className="table-row">
                  <div className="table-cell label">Avg Grain Length (mm)</div>
                  <div className="table-cell value">{results.avg_grain_length_mm}</div>
                </div>

                <div className="table-row">
                  <div className="table-cell label">Avg Grain Width (mm)</div>
                  <div className="table-cell value">{results.avg_grain_width_mm}</div>
                </div>
              </div>
            </div>

            {results.note && (
              <div style={{ marginTop: 16, color: '#757575', fontSize: 13 }}>
                {results.note}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="spinner"></div>
            <div className="loading-text">Processing image...</div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="footer">
        <div className="footer-text">
          {"\u00A9 2025 CargoFirst • RiceGuard Quality AI • Developed by Akash"}
        </div>
      </div>
    </div>
  );
};

export default RiceGuardApp;