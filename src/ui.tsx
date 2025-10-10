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

  React.useEffect(() => {
    // Listen for messages from plugin code
    window.onmessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as PluginMessage;
      console.log('UI received message:', msg);

      if (msg.type === 'collections-data') {
        console.log('Setting collections:', msg.data);
        setCollections(msg.data || []);
        setLoading(false);
        if (msg.data && msg.data.length > 0 && !selectedCollection) {
          setSelectedCollection(msg.data[0].id);
        }
      } else if (msg.type === 'error') {
        setError(msg.error || 'Unknown error');
        setLoading(false);
      }
    };
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
            Showing variables used on current page
          </p>
        </div>
        <div className="header-actions">
          <button onClick={handleRefresh} className="btn-secondary">Refresh</button>
          <button onClick={handleClose} className="btn-secondary">Close</button>
        </div>
      </div>

      <div className="search-bar">
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
          </button>
        ))}
      </div>

      {activeCollection && (
        <div className="content">
          <div className="collection-info">
            <h2>{activeCollection.name}</h2>
            <p>{activeCollection.variables.length} variables, {activeCollection.modes.length} modes</p>
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
                    <tr key={variable.id}>
                      <td className="var-name">
                        <button
                          className="node-link"
                          onClick={() => handleSelectNodes(variable.nodeIds)}
                          title={`Used by ${variable.nodeIds.length} node${variable.nodeIds.length > 1 ? 's' : ''}`}
                        >
                          {variable.name}
                        </button>
                        <span className="node-count">({variable.nodeIds.length})</span>
                      </td>
                      <td className="var-type">{variable.resolvedType}</td>
                      {activeCollection.modes.map(mode => {
                        const value = variable.valuesByMode[mode.modeId];
                        return (
                          <td key={mode.modeId} className="var-value">
                            {formatValue(value, variable.resolvedType)}
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

console.log('UI script loaded');
const rootElement = document.getElementById('root');
console.log('Root element:', rootElement);

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
  console.log('App rendered');
} else {
  console.error('Root element not found');
}
