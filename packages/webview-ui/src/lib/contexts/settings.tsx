import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export interface DiagramSettings {
  layout: 'TB' | 'LR' | 'BT' | 'RL';
  showFieldTypes: boolean;
  showFieldIcons: boolean;
  showMinimap: boolean;
  showBackground: boolean;
  backgroundVariant: 'lines' | 'dots' | 'cross';
  theme: {
    primaryColor: string;
    secondaryColor: string;
    enumColor: string;
    titleColor: string;
    backgroundColor: string;
  };
}

export const DEFAULT_SETTINGS: DiagramSettings = {
  layout: 'TB',
  showFieldTypes: true,
  showFieldIcons: true,
  showMinimap: true,
  showBackground: true,
  backgroundVariant: 'lines',
  theme: {
    primaryColor: '#3b82f6',
    secondaryColor: '#6366f1',
    enumColor: '#10b981',
    titleColor: '#ffffff',
    backgroundColor: '',
  },
};

interface SettingsContextType {
  settings: DiagramSettings;
  updateSetting: <K extends keyof DiagramSettings>(
    key: K,
    value: DiagramSettings[K],
  ) => void;
  updateTheme: (themeUpdates: Partial<DiagramSettings['theme']>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const [settings, setSettings] = useState<DiagramSettings>(DEFAULT_SETTINGS);

  const updateSetting = useCallback(
    <K extends keyof DiagramSettings>(key: K, value: DiagramSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateTheme = useCallback(
    (themeUpdates: Partial<DiagramSettings['theme']>) => {
      setSettings((prev) => ({
        ...prev,
        theme: { ...prev.theme, ...themeUpdates },
      }));
    },
    [],
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const contextValue = useMemo(
    () => ({ settings, updateSetting, updateTheme, resetSettings }),
    [settings, updateSetting, updateTheme, resetSettings],
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};
