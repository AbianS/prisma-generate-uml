import { useEffect, useState } from 'react';
import { SchemaVisualizer } from './components/SchemaVisualizer';
import { ThemeProvider } from './lib/contexts/theme';
import { SettingsProvider } from './lib/contexts/settings';
import { FilterProvider } from './lib/contexts/filter';
import {
  ColorThemeKind,
  Enum,
  Model,
  ModelConnection,
} from './lib/types/schema';
import { ReactFlowProvider } from '@xyflow/react';
import { getVsCodeApi } from './lib/utils/vscode-api';

function App() {
  const [models, setModels] = useState<Model[]>([]);
  const [enums, setEnums] = useState<Enum[]>([]);
  const [theme, setTheme] = useState<ColorThemeKind>(ColorThemeKind.Dark);
  const [connections, setConnections] = useState<ModelConnection[]>([]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const message = event.data;

      if (message.command === 'setData') {
        setModels(message.models);
        setConnections(message.connections);
        setEnums(message.enums);
      }

      if (message.command === 'setTheme') {
        setTheme(message.theme);
      }
    }

    window.addEventListener('message', handleMessage);

    // Notify extension that webview is ready
    const vscode = getVsCodeApi();
    if (vscode) {
      vscode.postMessage({ command: 'webviewReady' });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <SettingsProvider>
        <FilterProvider>
          <ReactFlowProvider>
            {models.length > 0 ? (
              <SchemaVisualizer
                models={models}
                connections={connections}
                enums={enums}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100vh',
                  color: 'var(--vscode-foreground)',
                }}
              >
                Loading schema…
              </div>
            )}
          </ReactFlowProvider>
        </FilterProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

export default App;
