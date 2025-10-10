import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { CollectionData, PluginMessage } from './types';
import './ui.css';

const App = () => {
  const [collections, setCollections] = React.useState<CollectionData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCollection, setSelectedCollection] = React.useState<string | null>(null);
  const [scanMode, setScanMode] = React.useState<'page' | 'selection'>('page');

  React.useEffect(() => {
    // Listen for messages from plugin code
    window.onmessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as PluginMessage;
      console.log('UI received message:', msg);

      if (msg.type === 'collections-data') {
        console.log('Setting collections:', msg.data);
        setCollections(msg.data || []);
        setLoading(false);
        if (msg.scanMode) {
          setScanMode(msg.scanMode);
        }
        if (msg.data && msg.data.length > 0 && !selectedCollection) {
          setSelectedCollection(msg.data[0].id);
        }
      } else if (msg.type === 'error') {
        setError(msg.error || 'Unknown error');
        setLoading(false);
      }
    };

    // Tell plugin that UI is ready
    parent.postMessage({ pluginMessage: { type: 'ready' } }, '*');
  }, [selectedCollection]);

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    parent.postMessage({ pluginMessage: { type: 'refresh' } }, '*');
  };

  const handleClose = () => {
    parent.postMessage({ pluginMessage: { type: 'close' } }, '*');
  };

  const handleSelectNodes = (nodeIds: string[]) => {
    parent.postMessage({ pluginMessage: { type: 'select-nodes', nodeIds } }, '*');
  };

  const handleUpdateVariable = (variableId: string, modeId: string, value: any) => {
    parent.postMessage({
      pluginMessage: {
        type: 'update-variable',
        variableId,
        modeId,
        value
      }
    }, '*');
  };

  const handleScanModeChange = (mode: 'page' | 'selection') => {
    setScanMode(mode);
    parent.postMessage({
      pluginMessage: {
        type: 'set-scan-mode',
        scanMode: mode
      }
    }, '*');
  };

  const filteredCollections = collections.map(collection => ({
    ...collection,
    variables: collection.variables.filter(variable =>
      variable.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }));

  const activeCollection = filteredCollections.find(c => c.id === selectedCollection);

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading variable collections...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">
          <p>Error: {error}</p>
          <button onClick={handleRefresh}>Try Again</button>
        </div>
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="container">
        <div className="empty">
          <p>No variables found on the current page.</p>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
            Variables must be applied to nodes on this page to appear here.
          </p>
          <button onClick={handleClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>Modes Viewer</h1>
          <p style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
            Showing variables used on {scanMode === 'page' ? 'current page' : 'selection'}
          </p>
        </div>
        <div className="header-actions">
          <button onClick={handleRefresh} className="btn-secondary">Refresh</button>
          <button onClick={handleClose} className="btn-secondary">Close</button>
        </div>
      </div>

      <div className="search-bar">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ fontSize: '12px', color: '#666' }}>Scan:</label>
          <button
            onClick={() => handleScanModeChange('page')}
            className={scanMode === 'page' ? 'btn-mode-active' : 'btn-mode'}
          >
            Page
          </button>
          <button
            onClick={() => handleScanModeChange('selection')}
            className={scanMode === 'selection' ? 'btn-mode-active' : 'btn-mode'}
          >
            Selection
          </button>
        </div>
        <input
          type="text"
          placeholder="Search variables..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="collection-tabs">
        {collections.map(collection => (
          <button
            key={collection.id}
            className={`tab ${selectedCollection === collection.id ? 'active' : ''}`}
            onClick={() => setSelectedCollection(collection.id)}
          >
            {collection.name}
            {collection.isGhost && <span className="ghost-badge-tab" title="Library unavailable">⚠️</span>}
          </button>
        ))}
      </div>

      {activeCollection && (
        <div className="content">
          <div className="collection-info">
            <h2>{activeCollection.name}</h2>
            <p>
              {activeCollection.variables.length} variables, {activeCollection.modes.length} modes
              {activeCollection.isRemote && activeCollection.libraryName && (
                <span className="library-info"> • From library: <strong>{activeCollection.libraryName}</strong></span>
              )}
              {activeCollection.isGhost && (
                <span className="ghost-badge"> ⚠️ Library unavailable</span>
              )}
            </p>
            {activeCollection.isRemote && !activeCollection.isGhost && (
              <div className="library-notice">
                📚 This is a library collection. Variables are read-only. To edit, open the library file and run the plugin there.
              </div>
            )}
            {activeCollection.isGhost && (
              <div className="ghost-notice">
                ⚠️ <strong>Ghost Library Detected:</strong> This collection references a library that is no longer available (deleted, removed, or access revoked).
                You can now edit these values locally, but they won't sync with any library. Consider replacing these variables with local ones.
              </div>
            )}
          </div>

          {activeCollection.variables.length === 0 ? (
            <div className="empty-state">
              No variables match your search.
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th className="var-name-col">Variable Name</th>
                    <th className="var-type-col">Type</th>
                    {activeCollection.modes.map(mode => (
                      <th key={mode.modeId} className="mode-col">{mode.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeCollection.variables.map(variable => (
                    <tr key={variable.id} className={variable.isRemote && !activeCollection.isGhost ? 'remote-variable' : ''}>
                      <td className="var-name">
                        <button
                          className="node-link"
                          onClick={() => handleSelectNodes(variable.nodeIds)}
                          title={`Used by ${variable.nodeIds.length} node${variable.nodeIds.length > 1 ? 's' : ''}`}
                        >
                          {variable.name}
                        </button>
                        <span className="node-count">({variable.nodeIds.length})</span>
                        {variable.isRemote && !activeCollection.isGhost && <span className="library-badge" title="From library">📚</span>}
                        {activeCollection.isGhost && <span className="ghost-badge-inline" title="Ghost library - editable">👻</span>}
                      </td>
                      <td className="var-type">{variable.resolvedType}</td>
                      {activeCollection.modes.map(mode => {
                        const value = variable.valuesByMode[mode.modeId];
                        const isEditable = !variable.isRemote || activeCollection.isGhost;
                        return (
                          <td key={mode.modeId} className="var-value">
                            <EditableCell
                              value={value}
                              type={variable.resolvedType}
                              variableId={variable.id}
                              modeId={mode.modeId}
                              isRemote={isEditable ? false : variable.isRemote}
                              onUpdate={handleUpdateVariable}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Editable cell component
const EditableCell = ({
  value,
  type,
  variableId,
  modeId,
  isRemote,
  onUpdate
}: {
  value: any;
  type: string;
  variableId: string;
  modeId: string;
  isRemote: boolean;
  onUpdate: (variableId: string, modeId: string, value: any) => void;
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState('');

  const handleStartEdit = () => {
    if (isRemote) return; // Don't allow editing library variables

    if (typeof value === 'string' && value.startsWith('→')) {
      return; // Don't allow editing alias values
    }

    setIsEditing(true);

    // Set initial value based on type
    if (type === 'COLOR' && typeof value === 'object' && 'r' in value) {
      setEditValue(rgbToHex(value.r, value.g, value.b));
    } else if (type === 'FLOAT') {
      setEditValue(value.toString());
    } else {
      setEditValue(value.toString());
    }
  };

  const handleSave = () => {
    let parsedValue: any = editValue;

    if (type === 'COLOR') {
      // Convert hex to RGB
      parsedValue = hexToRgb(editValue);
    } else if (type === 'FLOAT') {
      parsedValue = editValue; // Will be parsed in backend
    }

    onUpdate(variableId, modeId, parsedValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        className="edit-input"
      />
    );
  }

  const formattedValue = formatValue(value, type);
  const isEditable = !isRemote && !(typeof value === 'string' && value.startsWith('→'));

  return (
    <div
      className={`cell-value ${isEditable ? 'editable' : 'readonly'}`}
      onClick={handleStartEdit}
      title={isRemote ? 'Library variable (read-only)' : isEditable ? 'Click to edit' : 'Alias (read-only)'}
    >
      {formattedValue}
    </div>
  );
};

function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
    a: 1
  } : { r: 0, g: 0, b: 0, a: 1 };
}

function formatValue(value: any, type: string): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="null-value">—</span>;
  }

  if (typeof value === 'string') {
    // Check if it's an alias reference
    if (value.startsWith('→')) {
      return <span className="alias-value">{value}</span>;
    }
    return value;
  }

  if (type === 'COLOR' && typeof value === 'object' && 'r' in value) {
    const { r, g, b, a = 1 } = value;
    const hex = rgbToHex(r, g, b);
    return (
      <div className="color-value">
        <div
          className="color-swatch"
          style={{ backgroundColor: `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})` }}
        />
        <span>{hex}</span>
      </div>
    );
  }

  if (typeof value === 'number') {
    return value.toFixed(2);
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return JSON.stringify(value);
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Resize handle component
const ResizeHandle = () => {
  React.useEffect(() => {
    const corner = document.getElementById('resize-handle');
    if (!corner) return;

    const resizeWindow = (e: PointerEvent) => {
      const size = {
        w: Math.max(400, Math.floor(e.clientX + 5)),
        h: Math.max(300, Math.floor(e.clientY + 5))
      };
      parent.postMessage({ pluginMessage: { type: 'resize', size } }, '*');
    };

    const handlePointerDown = (e: PointerEvent) => {
      corner.onpointermove = resizeWindow;
      corner.setPointerCapture(e.pointerId);
    };

    const handlePointerUp = (e: PointerEvent) => {
      corner.onpointermove = null;
      corner.releasePointerCapture(e.pointerId);
    };

    corner.addEventListener('pointerdown', handlePointerDown);
    corner.addEventListener('pointerup', handlePointerUp);

    return () => {
      corner.removeEventListener('pointerdown', handlePointerDown);
      corner.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  return (
    <svg
      id="resize-handle"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      style={{
        position: 'fixed',
        bottom: '4px',
        right: '4px',
        cursor: 'nwse-resize',
        opacity: 0.3,
        zIndex: 9999
      }}
    >
      <path d="M16 0v16H0" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M6 16L16 6" stroke="currentColor" strokeWidth="1" />
      <path d="M10 16L16 10" stroke="currentColor" strokeWidth="1" />
      <path d="M14 16L16 14" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
};

console.log('UI script loaded');
const rootElement = document.getElementById('root');
console.log('Root element:', rootElement);

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <>
      <App />
      <ResizeHandle />
    </>
  );
  console.log('App rendered');
} else {
  console.error('Root element not found');
}
