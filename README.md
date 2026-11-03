<br />
<p align="center">
    <a href="#" target="_blank"><img src="./packages/prisma-generate-uml/media/readme/banner.jpg" alt="logo"></a>
    <br />
    <br />
    <b>Prisma Generate UML</b> is a VSCode extension that quickly creates UML diagrams from Prisma schemas with a single click, offering easy visualization.
    <br />
    <br />
</p>

> _You can download final bundles from the [Releases](https://github.com/AbianS/prisma-generate-uml/releases) section._

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white) ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white) ![Prisma ORM](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white) ![esbuild](https://img.shields.io/badge/esbuild-FFCF00?style=for-the-badge&logo=esbuild&logoColor=white) ![Biome](https://img.shields.io/badge/Biome-009688?style=for-the-badge&logo=biome&logoColor=white)

> [!NOTE]
> 🚧
> **Prisma Generate UML** is currently under development. Stay tuned for more updates!

![Example](media/readme/example.gif)

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "Prisma Input"
        SCHEMA["📝 schema.prisma<br/>Prisma schema file<br/>Models, Enums, Relations"]
        FILE_WATCHER["👁️ File Watcher<br/>Detects .prisma changes"]
    end
    
    subgraph "VSCode Environment"
        EDITOR["📝 VSCode Editor<br/>Editor interface"]
        CMD["⚡ Command Palette<br/>prisma-generate-uml.generateUML"]
        ICON["🔗 UML Icon<br/>Toolbar button"]
    end
    
    subgraph "Extension Core"
        EXT_ENTRY["🚀 extension.ts<br/>Entry point<br/>Command registration"]
        PARSER["⚡ DMMF Parser<br/>@prisma/internals<br/>getDMMF() + getSchemaWithPath()"]
        RENDER["🎨 Render Engine<br/>transformDmmfToModelsAndConnections()<br/>Generates Models, Connections, Enums"]
        PANEL_MGR["📋 PrismaUMLPanel<br/>Manages WebView lifecycle<br/>postMessage() communication"]
    end
    
    subgraph "WebView Container"
        WEBVIEW["🌐 VSCode WebView<br/>Isolated container<br/>HTML + CSS + JS"]
        CSP["🔒 Content Security Policy<br/>WebView security"]
    end
    
    subgraph "React Application"
        APP["⚛️ App.tsx<br/>Root component<br/>Global state"]
        THEME["🎨 Theme Provider<br/>VSCode theme handling"]
        VISUALIZER["📊 SchemaVisualizer<br/>Main container"]
        FLOW_PROVIDER["🔄 ReactFlowProvider<br/>@xyflow/react context"]
    end
    
    subgraph "UML Components"
        FLOW["📊 ReactFlow Canvas<br/>Rendering engine<br/>Drag & Drop, Zoom, Pan"]
        MODEL_NODE["🏗️ ModelNode<br/>Model component<br/>Fields, Types, Relations"]
        ENUM_NODE["📝 EnumNode<br/>Enum component<br/>Enumerated values"]
        CONNECTIONS["🔗 Edges/Connections<br/>Model relationships"]
    end
    
    subgraph "Output Actions"
        SCREENSHOT["📸 Screenshot<br/>Export PNG/SVG"]
        DOWNLOAD["💾 Download<br/>Save image"]
    end
    
    SCHEMA --> FILE_WATCHER
    FILE_WATCHER --> EXT_ENTRY
    EDITOR --> CMD
    EDITOR --> ICON
    CMD --> EXT_ENTRY
    ICON --> EXT_ENTRY
    
    EXT_ENTRY --> PARSER
    PARSER --> RENDER
    RENDER --> PANEL_MGR
    
    PANEL_MGR --> WEBVIEW
    WEBVIEW --> CSP
    CSP --> APP
    
    APP --> THEME
    APP --> VISUALIZER
    VISUALIZER --> FLOW_PROVIDER
    FLOW_PROVIDER --> FLOW
    
    FLOW --> MODEL_NODE
    FLOW --> ENUM_NODE
    FLOW --> CONNECTIONS
    
    MODEL_NODE --> SCREENSHOT
    ENUM_NODE --> SCREENSHOT
    SCREENSHOT --> DOWNLOAD
    
    DOWNLOAD -.-> PANEL_MGR
    PANEL_MGR -.-> EXT_ENTRY
```

## 📦 Project Structure

```
prisma-generate-uml/
├── packages/
│   ├── prisma-generate-uml/     # VSCode Extension
│   │   ├── src/
│   │   │   ├── extension.ts     # Entry point
│   │   │   ├── panels/          # WebView management
│   │   │   └── core/            # Rendering logic
│   │   └── package.json
│   │
│   ├── webview-ui/              # React Frontend
│   │   ├── src/
│   │   │   ├── App.tsx          # Main component
│   │   │   ├── components/      # UML Components
│   │   │   └── lib/             # Utils and types
│   │   └── package.json
│   │
│   └── schema.prisma            # Example schema
│
├── turbo.json                   # Turbo configuration
└── package.json                 # Root workspace
```

## 🚀 Development

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/AbianS/prisma-generate-uml.git
cd prisma-generate-uml

# Install dependencies
npm install

# Development
npm run dev
```

## ✨ Features

- 🔥 **Instant UML Diagrams**: Generate UML diagrams from Prisma schemas with a single click
- 🖼 **Easy Visualization**: Simplify data architecture visualization in an exciting way
- 🛠 **Seamless Integration**: Works seamlessly within VSCode, no extra configuration required
- 📂 **Multi-file Prisma Schema Support**: Full support for Prisma's `prismaSchemaFolder` feature
- ❓ **Nullable Field Indicators**: Optional fields are marked with a `?` suffix, just like in your Prisma schema
- 🔃 **Automatic Updates**: Keep your UML diagrams up-to-date with schema changes

## 🏃‍♂️ Quick Usage

You must have [the Prisma VSCode extension](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma)
installed to use this extension.

1. Open a `.prisma` file in VSCode
2. Look for the UML icon in the editor toolbar
3. Click it to generate the diagram instantly

## 🛠️ Technologies

- **Extension**: TypeScript + VSCode Extension API
- **WebView**: React + Vite + Tailwind CSS
- **UML Rendering**: React Flow + Custom Components  
- **Prisma Integration**: @prisma/internals DMMF
- **Monorepo**: Turbo + npm workspaces
- **Code Quality**: Biome (ESLint + Prettier alternative)

## 📄 License

MIT License - see [LICENSE](LICENSE) for more details.
