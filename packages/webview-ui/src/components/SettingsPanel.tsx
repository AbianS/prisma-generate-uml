import { Leva, folder, useControls } from 'leva';
import { useSettings } from '../lib/contexts/settings';
import { useTheme } from '../lib/contexts/theme';

export const SettingsPanel = () => {
  const { settings, updateSetting, updateTheme } = useSettings();
  const { isDarkMode } = useTheme();

  useControls({
    // Display Section
    Display: folder({
      direction: {
        value: settings.layout,
        options: {
          'Top to Bottom': 'TB',
          'Left to Right': 'LR',
          'Bottom to Top': 'BT',
          'Right to Left': 'RL',
        },
        onChange: (value) => updateSetting('layout', value as any),
      },
      showMinimap: {
        value: settings.showMinimap,
        onChange: (value) => updateSetting('showMinimap', value),
      },
      showBackground: {
        value: settings.showBackground,
        onChange: (value) => updateSetting('showBackground', value),
      },
      backgroundVariant: {
        value: settings.backgroundVariant,
        options: {
          Lines: 'lines',
          Dots: 'dots',
          Cross: 'cross',
        },
        onChange: (value) => updateSetting('backgroundVariant', value as any),
      },
      showFieldTypes: {
        value: settings.showFieldTypes,
        onChange: (value) => updateSetting('showFieldTypes', value),
      },
      showFieldIcons: {
        value: settings.showFieldIcons,
        onChange: (value) => updateSetting('showFieldIcons', value),
      },
    }),

    // Theme Section
    Theme: folder({
      primaryColor: {
        value: settings.theme.primaryColor,
        onChange: (value) => updateTheme({ primaryColor: value }),
      },
      secondaryColor: {
        value: settings.theme.secondaryColor,
        onChange: (value) => updateTheme({ secondaryColor: value }),
      },
      enumColor: {
        value: settings.theme.enumColor,
        onChange: (value) => updateTheme({ enumColor: value }),
      },
      titleColor: {
        value: settings.theme.titleColor,
        onChange: (value) => updateTheme({ titleColor: value }),
      },
    }),
  });

  return (
    <Leva
      theme={{
        colors: {
          elevation1: isDarkMode ? '#1c1c1c' : '#ffffff',
          elevation2: isDarkMode ? '#2a2a2a' : '#f5f5f5',
          elevation3: isDarkMode ? '#333333' : '#e5e5e5',
          accent1: settings.theme.primaryColor,
          accent2: settings.theme.secondaryColor,
          accent3: isDarkMode ? '#6b7280' : '#9ca3af',
          highlight1: settings.theme.primaryColor,
          highlight2: settings.theme.secondaryColor,
          highlight3: isDarkMode ? '#374151' : '#d1d5db',
          vivid1: settings.theme.primaryColor,
          folderWidgetColor: isDarkMode ? '#374151' : '#d1d5db',
          folderTextColor: isDarkMode ? '#ffffff' : '#000000',
          toolTipBackground: isDarkMode ? '#000000' : '#ffffff',
          toolTipText: isDarkMode ? '#ffffff' : '#000000',
        },
        sizes: {
          rootWidth: '280px',
        },
      }}
      titleBar={{
        drag: false,
        title: 'Settings',
      }}
      collapsed={true}
    />
  );
};
