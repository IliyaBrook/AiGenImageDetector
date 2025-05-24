import { useEffect, useState } from "react";

interface AnalyzeLog {
  time: string;
  imageUrl: string;
  isAIGenerated: boolean;
  confidence?: number;
}

function Logs(): JSX.Element {
  const [logs, setLogs] = useState<AnalyzeLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadLogs = () => {
    setLoading(true);
    try {
      chrome.storage.local.get(
        ["analyzeLogs"],
        (result: { analyzeLogs?: AnalyzeLog[] }) => {
          console.log("Logs from storage:", result);
          setLogs(Array.isArray(result.analyzeLogs) ? result.analyzeLogs : []);
          setLoading(false);
        }
      );
    } catch (error) {
      console.error("Error loading logs:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    const storageListener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (changes.analyzeLogs) {
        console.log("Storage changed, reloading logs");
        loadLogs();
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  const clearLogs = () => {
    if (confirm("Are you sure you want to clear all logs?")) {
      chrome.storage.local.set({ analyzeLogs: [] }, () => {
        setLogs([]);
        console.log("Logs cleared");
      });
    }
  };

  const styles: { [key: string]: React.CSSProperties } = {
    container: {
      padding: '24px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '24px',
      flexWrap: 'wrap',
      gap: '16px',
    },
    title: {
      margin: 0,
      fontSize: '28px',
      fontWeight: 600,
      color: 'white',
      textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    buttonGroup: {
      display: 'flex',
      gap: '12px',
    },
    button: {
      padding: '12px 20px',
      border: 'none',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
    },
    refreshButton: {
      background: 'linear-gradient(135deg, #4ade80, #22c55e)',
      color: 'white',
      boxShadow: '0 4px 12px rgba(74, 222, 128, 0.3)',
    },
    clearButton: {
      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
      color: 'white',
      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
    },
    loadingContainer: {
      textAlign: 'center' as const,
      padding: '40px 20px',
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
    emptyContainer: {
      textAlign: 'center' as const,
      padding: '40px 20px',
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
    tableContainer: {
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      overflow: 'hidden',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
    },
    tableHeader: {
      background: 'rgba(0, 0, 0, 0.2)',
    },
    tableHeaderCell: {
      padding: '16px 12px',
      color: 'rgba(255, 255, 255, 0.9)',
      fontWeight: 600,
      fontSize: '14px',
      textAlign: 'left' as const,
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    },
    tableRow: {
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      transition: 'background-color 0.2s ease',
    },
    tableCell: {
      padding: '12px',
      fontSize: '14px',
      verticalAlign: 'top' as const,
    },
    urlCell: {
      maxWidth: '300px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
    urlLink: {
      color: '#60a5fa',
      textDecoration: 'none',
      transition: 'color 0.2s ease',
    },
    aiGeneratedYes: {
      color: '#ef4444',
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    aiGeneratedNo: {
      color: '#4ade80',
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    footer: {
      marginTop: '24px',
      fontSize: '13px',
      color: 'rgba(255, 255, 255, 0.7)',
      textAlign: 'center' as const,
      padding: '16px',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          <span>📊</span> AI Image Analysis Logs
        </h2>
        <div style={styles.buttonGroup}>
          <button
            onClick={loadLogs}
            style={{...styles.button, ...styles.refreshButton}}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(74, 222, 128, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(74, 222, 128, 0.3)';
            }}
          >
            🔄 Refresh
          </button>
          <button
            onClick={clearLogs}
            style={{...styles.button, ...styles.clearButton}}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
            }}
          >
            🗑️ Clear Logs
          </button>
        </div>
      </div>

      {loading ? (
        <div style={styles.loadingContainer}>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>⏳ Loading logs...</div>
        </div>
      ) : logs.length === 0 ? (
        <div style={styles.emptyContainer}>
          <div style={{ fontSize: '18px', marginBottom: '12px' }}>📭 No logs found</div>
          <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.8)' }}>
            Browse some websites with images to detect AI-generated content.
          </p>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead style={styles.tableHeader}>
              <tr>
                <th style={styles.tableHeaderCell}>🕐 Time</th>
                <th style={styles.tableHeaderCell}>🔗 Image URL</th>
                <th style={styles.tableHeaderCell}>🤖 AI Generated?</th>
                <th style={styles.tableHeaderCell}>🎯 Confidence</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr 
                  key={i} 
                  style={styles.tableRow}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td style={styles.tableCell}>
                    {new Date(log.time).toLocaleString()}
                  </td>
                  <td style={{...styles.tableCell, ...styles.urlCell}}>
                    <a
                      href={log.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.urlLink}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#93c5fd';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#60a5fa';
                      }}
                    >
                      {log.imageUrl.length > 60
                        ? log.imageUrl.substring(0, 57) + "..."
                        : log.imageUrl}
                    </a>
                  </td>
                  <td style={styles.tableCell}>
                    <div style={log.isAIGenerated ? styles.aiGeneratedYes : styles.aiGeneratedNo}>
                      <span>{log.isAIGenerated ? "❌" : "✅"}</span>
                      <span>{log.isAIGenerated ? "Yes" : "No"}</span>
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    <span style={{ 
                      background: 'rgba(255, 255, 255, 0.1)', 
                      padding: '4px 8px', 
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}>
                      {log.confidence !== undefined
                        ? `${Math.round(log.confidence * 100)}%`
                        : "N/A"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={styles.footer}>
        <span>ℹ️</span> Note: Images are analyzed using AI detection models and results may not be 100% accurate.
      </div>
    </div>
  );
}

export default Logs;
