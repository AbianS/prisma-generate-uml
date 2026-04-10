interface VsCodeApi {
  postMessage(message: any): void;
  setState(state: any): void;
  getState(): any;
}

declare function acquireVsCodeApi(): VsCodeApi;

// Acquire the VS Code API only once and export it
let vscodeApi: VsCodeApi | null = null;

export function getVsCodeApi(): VsCodeApi | null {
  if (vscodeApi) {
    return vscodeApi;
  }

  try {
    if (typeof acquireVsCodeApi !== 'undefined') {
      vscodeApi = acquireVsCodeApi();
      return vscodeApi;
    }
  } catch (error) {
    console.error('Error acquiring VS Code API:', error);
  }

  return null;
}
