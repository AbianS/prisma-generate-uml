export const nodeColor = (isDarkMode: boolean) =>
  isDarkMode ? '#3d5797' : '#8b9dc3';

export const nodeStrokeColor = (isDarkMode: boolean) =>
  isDarkMode ? '#282828' : '#e0e0e0';

export const maskColor = (isDarkMode: boolean) =>
  isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)';

export const getButtonStyle = (selectedLayout: string, layout: string) => {
  return selectedLayout === layout
    ? 'bg-blue-500 text-white px-4 py-2 rounded'
    : 'bg-gray-300 text-black px-4 py-2 rounded';
};
