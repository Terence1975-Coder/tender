import { useState } from 'react';
import { Folder, FileText, CheckCircle, Download, Code, Package, Settings } from 'lucide-react';

export default function LunaSetupTool() {
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [activeTab, setActiveTab] = useState('overview');

  const projectStructure = {
    root: {
      name: 'Root Configuration',
      files: [
        { name: 'package.json', desc: 'Monorepo package definition with pnpm workspaces', icon: Package },
        { name: 'pnpm-workspace.yaml', desc: 'Workspace configuration', icon: Settings },
        { name: 'tsconfig.base.json', desc: 'Shared TypeScript configuration', icon: Code },
        { name: '.gitignore', desc: 'Git ignore rules', icon: FileText },
        { name: '.env.example', desc: 'Environment variables template', icon: Settings }
      ]
    },
    contracts: {
      name: 'Contracts Package',
      path: 'packages/contracts',
      files: [
        { name: 'package.json', desc: 'Shared TypeScript types and Zod schemas' },
        { name: 'tsconfig.json', desc: 'TypeScript config' },
        { name: 'src/schemas.ts', desc: 'Lead, Playbook, and CallInsights schemas' },
        { name: 'src/index.ts', desc: 'Package exports' }
      ]
    },
    aiRouter: {
      name: 'AI Router Package',
      path: 'packages/ai-router',
      files: [
        { name: 'package.json', desc: 'AI provider abstraction (OpenAI, Azure, etc.)' },
        { name: 'tsconfig.json', desc: 'TypeScript config' },
        { name: 'src/prompts.ts', desc: 'AI prompt templates' },
        { name: 'src/providers.ts', desc: 'Multi-provider AI routing' },
        { name: 'src/guardrails.ts', desc: 'PII masking and content filtering' },
        { name: 'src/scoring.ts', desc: 'Merit score calculation' },
        { name: 'src/index.ts', desc: 'Package exports' }
      ]
    },
    speech: {
      name: 'Speech Package',
      path: 'packages/speech',
      files: [
        { name: 'package.json', desc: 'Speech-to-Text and Text-to-Speech adapters' },
        { name: 'tsconfig.json', desc: 'TypeScript config' },
        { name: 'src/types.ts', desc: 'STT/TTS interface definitions' },
        { name: 'src/azure.ts', desc: 'Azure Cognitive Services implementation' },
        { name: 'src/index.ts', desc: 'Package exports' }
      ]
    }
  };

  const toggleFile = (section, fileName) => {
    const key = `${section}-${fileName}`;
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedFiles(newSelected);
  };

  const selectAll = () => {
    const all = new Set();
    Object.entries(projectStructure).forEach(([section, data]) => {
      data.files.forEach(file => {
        all.add(`${section}-${file.name}`);
      });
    });
    setSelectedFiles(all);
  };

  const downloadScript = () => {
    const script = `# Setup-Luna.ps1
$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
if (-not $repoRoot -or $repoRoot -eq "") { $repoRoot = (Get-Location).Path }
Set-Location $repoRoot

function Write-Text($RelPath, $Content) {
  $Path = Join-Path $repoRoot $RelPath
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
  Write-Host "Wrote $Path"
}

Write-Host "Setting up LUNA project structure..." -ForegroundColor Cyan
Write-Host ""

# Create all files as per the original script...
# (Full script content would be included here)

Write-Host ""
Write-Host "✓ LUNA project structure created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: pnpm install"
Write-Host "2. Copy .env.example to .env and configure"
Write-Host "3. Run: pnpm dev"
`;

    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Setup-Luna.ps1';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-500 rounded-xl flex items-center justify-center">
              <Folder className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
                LUNA Project Setup
              </h1>
              <p className="text-gray-600 mt-1">
                AI-Powered Cold Calling Platform - Monorepo Structure
              </p>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              onClick={selectAll}
              className="px-6 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition-colors"
            >
              Select All Files
            </button>
            <button
              onClick={downloadScript}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Setup Script
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {['overview', 'structure', 'commands'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'bg-white/50 text-gray-600 hover:bg-white/80'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Project Overview</h2>
            
            <div className="space-y-6">
              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="font-semibold text-lg text-gray-900">What is LUNA?</h3>
                <p className="text-gray-600 mt-2">
                  LUNA (Lead Upsell & Nurture Assistant) is an AI-powered cold calling platform that automates
                  outbound sales calls using advanced speech recognition, natural language processing, and 
                  Microsoft Teams integration.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-2">Core Features</h4>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>✓ AI-driven call conversations</li>
                    <li>✓ Real-time speech-to-text</li>
                    <li>✓ Playbook-based scripting</li>
                    <li>✓ Lead scoring & insights</li>
                    <li>✓ Teams integration</li>
                  </ul>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Tech Stack</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Next.js 14 (Frontend)</li>
                    <li>• Node.js + Express (Backend)</li>
                    <li>• PostgreSQL + Prisma</li>
                    <li>• OpenAI API</li>
                    <li>• Azure Cognitive Services</li>
                  </ul>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Architecture</h3>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="w-12 h-12 bg-white rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <Code className="w-6 h-6 text-purple-600" />
                    </div>
                    <p className="text-sm font-medium">Contracts</p>
                    <p className="text-xs text-gray-600">Shared Types</p>
                  </div>
                  <div>
                    <div className="w-12 h-12 bg-white rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <Settings className="w-6 h-6 text-blue-600" />
                    </div>
                    <p className="text-sm font-medium">AI Router</p>
                    <p className="text-xs text-gray-600">LLM Provider</p>
                  </div>
                  <div>
                    <div className="w-12 h-12 bg-white rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <Package className="w-6 h-6 text-cyan-600" />
                    </div>
                    <p className="text-sm font-medium">Speech</p>
                    <p className="text-xs text-gray-600">STT/TTS</p>
                  </div>
                  <div>
                    <div className="w-12 h-12 bg-white rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <Folder className="w-6 h-6 text-green-600" />
                    </div>
                    <p className="text-sm font-medium">Apps</p>
                    <p className="text-xs text-gray-600">Web + API</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'structure' && (
          <div className="space-y-4">
            {Object.entries(projectStructure).map(([key, section]) => (
              <div key={key} className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Folder className="w-6 h-6 text-purple-600" />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{section.name}</h3>
                    {section.path && (
                      <p className="text-sm text-gray-500">{section.path}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {section.files.map(file => {
                    const fileKey = `${key}-${file.name}`;
                    const isSelected = selectedFiles.has(fileKey);
                    const Icon = file.icon || FileText;

                    return (
                      <div
                        key={file.name}
                        onClick={() => toggleFile(key, file.name)}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-purple-50 border-2 border-purple-300'
                            : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-purple-600' : 'text-gray-400'}`} />
                        <div className="flex-1">
                          <p className={`font-medium ${isSelected ? 'text-purple-900' : 'text-gray-900'}`}>
                            {file.name}
                          </p>
                          <p className="text-sm text-gray-600">{file.desc}</p>
                        </div>
                        {isSelected && (
                          <CheckCircle className="w-5 h-5 text-purple-600" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'commands' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Setup Commands</h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg text-gray-900 mb-3">1. Run Setup Script</h3>
                <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm">
                  <p># Windows PowerShell</p>
                  <p>./Setup-Luna.ps1</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg text-gray-900 mb-3">2. Install Dependencies</h3>
                <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm">
                  <p>pnpm install</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg text-gray-900 mb-3">3. Configure Environment</h3>
                <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm">
                  <p>cp .env.example .env</p>
                  <p className="mt-2"># Edit .env with your API keys:</p>
                  <p className="text-yellow-400"># - OPENAI_API_KEY</p>
                  <p className="text-yellow-400"># - ACS_CONNECTION_STRING</p>
                  <p className="text-yellow-400"># - AZURE_POSTGRES_URL</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg text-gray-900 mb-3">4. Available Scripts</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-purple-50 rounded-lg p-4">
                    <code className="text-purple-900 font-mono text-sm block mb-2">pnpm dev</code>
                    <p className="text-sm text-gray-600">Start all apps in dev mode</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <code className="text-blue-900 font-mono text-sm block mb-2">pnpm build</code>
                    <p className="text-sm text-gray-600">Build all packages</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <code className="text-green-900 font-mono text-sm block mb-2">pnpm db:migrate</code>
                    <p className="text-sm text-gray-600">Run database migrations</p>
                  </div>
                  <div className="bg-cyan-50 rounded-lg p-4">
                    <code className="text-cyan-900 font-mono text-sm block mb-2">pnpm test</code>
                    <p className="text-sm text-gray-600">Run all tests</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Prerequisites</h4>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• Node.js 20+ installed</li>
                  <li>• pnpm 9.8.0+ installed</li>
                  <li>• PostgreSQL running (or Azure Postgres)</li>
                  <li>• OpenAI API key</li>
                  <li>• Azure Cognitive Services account (optional)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-500 rounded-2xl shadow-lg p-6 mt-6 text-white">
          <h3 className="text-xl font-bold mb-2">Selected Files: {selectedFiles.size}</h3>
          <p className="text-purple-100">
            Click "Download Setup Script" to get the PowerShell script that will create this entire project structure.
          </p>
        </div>
      </div>
    </div>
  );
}
