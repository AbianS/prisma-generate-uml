import { Edge } from '@xyflow/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crosshair,
  Eye,
  EyeOff,
  List,
  Search,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFilter } from '../lib/contexts/filter';
import { useSettings } from '../lib/contexts/settings';
import { useTheme } from '../lib/contexts/theme';
import { type Enum, type Model } from '../lib/types/schema';
import { type LayoutDirection } from '../lib/utils/layout-utils';

interface SidebarProps {
  models: Model[];
  enums: Enum[];
  edges: Edge[];
  selectedLayout: LayoutDirection;
  onLayoutChange: (dir: LayoutDirection) => void;
}

const LAYOUT_OPTIONS: {
  dir: LayoutDirection;
  label: string;
  icon: React.ReactNode;
}[] = [
  { dir: 'TB', label: 'Top → Bottom', icon: <ArrowDown size={14} /> },
  { dir: 'LR', label: 'Left → Right', icon: <ArrowRight size={14} /> },
  { dir: 'BT', label: 'Bottom → Top', icon: <ArrowUp size={14} /> },
  { dir: 'RL', label: 'Right → Left', icon: <ArrowLeft size={14} /> },
];

export function Sidebar({
  models,
  enums,
  edges,
  selectedLayout,
  onLayoutChange,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(true);
  const [displayOpen, setDisplayOpen] = useState(true);
  const [themeOpen, setThemeOpen] = useState(false);
  const filter = useFilter();
  const { settings, updateSetting, updateTheme } = useSettings();
  const { isDarkMode } = useTheme();

  // Connection counts per node
  const connectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    edges.forEach((e) => {
      if (!e.hidden) {
        counts[e.source] = (counts[e.source] ?? 0) + 1;
        counts[e.target] = (counts[e.target] ?? 0) + 1;
      }
    });
    return counts;
  }, [edges]);

  // Filter list based on search query
  const query = filter.searchQuery.toLowerCase();
  const visibleModels = query
    ? models.filter((m) => m.name.toLowerCase().includes(query))
    : models;
  const visibleEnums = query
    ? enums.filter((e) => e.name.toLowerCase().includes(query))
    : enums;

  const dark = isDarkMode;
  const base = dark
    ? 'bg-[#161616] border-gray-800 text-gray-200'
    : 'bg-white border-gray-200 text-gray-800';
  const divider = dark ? 'border-gray-800' : 'border-gray-100';
  const sectionLabel = dark ? 'text-gray-500' : 'text-gray-400';
  const btnBase = dark
    ? 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
    : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700';
  const btnActive = dark
    ? 'bg-indigo-600 border-indigo-500 text-white'
    : 'bg-indigo-500 border-indigo-400 text-white';

  // ── Collapsed rail ────────────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <div
        className={`flex flex-col items-center py-3 gap-3 border-r ${base} w-10 h-full flex-shrink-0`}
      >
        <button
          onClick={() => setIsCollapsed(false)}
          title="Expand sidebar"
          className="opacity-60 hover:opacity-100 transition-opacity"
        >
          <ChevronRight size={15} />
        </button>
        <List size={14} className="opacity-30 mt-1" />
      </div>
    );
  }

  // ── Full sidebar ──────────────────────────────────────────────────────
  return (
    <aside
      className={`flex flex-col border-r ${base} w-[240px] h-full overflow-hidden flex-shrink-0`}
    >
      {/* ── Header ── */}
      <div
        className={`flex items-center justify-between px-3 py-2.5 border-b ${divider} flex-shrink-0`}
      >
        <span
          className={`text-[11px] font-semibold uppercase tracking-widest ${sectionLabel}`}
        >
          Schema
        </span>
        <button
          onClick={() => setIsCollapsed(true)}
          title="Collapse sidebar"
          className="opacity-50 hover:opacity-100 transition-opacity"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* ── Search ── */}
      <div className={`px-3 py-2 border-b ${divider} flex-shrink-0`}>
        <div className="relative">
          <Search
            size={11}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none"
          />
          <input
            type="text"
            aria-label="Search models"
            value={filter.searchQuery}
            onChange={(e) => filter.setSearchQuery(e.target.value)}
            placeholder="Search models…"
            className={[
              'w-full pl-7 pr-6 py-1.5 text-xs rounded-lg border outline-none',
              'focus:ring-1 focus:ring-indigo-500 transition-colors',
              dark
                ? 'bg-[#222] border-gray-700 text-gray-200 placeholder:text-gray-600'
                : 'bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400',
            ].join(' ')}
          />
          {filter.searchQuery && (
            <button
              onClick={() => filter.setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80 transition-opacity"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ── Node list (scrollable) ── */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1">
        {/* Focus banner */}
        {filter.focusedNodeId && (
          <div
            className={[
              'mx-2 mb-1 px-2 py-1 rounded-md text-xs flex items-center justify-between gap-1',
              dark
                ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200',
            ].join(' ')}
          >
            <span className="truncate">
              Focus:{' '}
              <strong className="font-semibold">{filter.focusedNodeId}</strong>
            </span>
            <button
              onClick={filter.clearFocus}
              className="flex-shrink-0 opacity-60 hover:opacity-100"
            >
              <X size={10} />
            </button>
          </div>
        )}

        {/* Focus depth selector */}
        {filter.focusedNodeId && (
          <div className="px-2 pb-2">
            <span
              className={`text-[10px] ${sectionLabel} uppercase tracking-wider`}
            >
              Depth
            </span>
            <div className="flex gap-1 mt-1">
              {([1, 2, 3] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => filter.setFocusDepth(d)}
                  className={[
                    'flex-1 py-1 text-xs rounded border font-medium transition-colors',
                    filter.focusDepth === d ? btnActive : btnBase,
                  ].join(' ')}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Models */}
        {visibleModels.length > 0 && (
          <>
            <div
              className={`px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-widest ${sectionLabel}`}
            >
              Models ({visibleModels.length})
            </div>
            {visibleModels.map((model) => (
              <NodeListItem
                key={model.name}
                name={model.name}
                connectionCount={connectionCounts[model.name] ?? 0}
                isHidden={filter.hiddenNodeIds.has(model.name)}
                isFocused={filter.focusedNodeId === model.name}
                onToggleHide={() => filter.toggleHideNode(model.name)}
                onFocus={() =>
                  filter.focusedNodeId === model.name
                    ? filter.clearFocus()
                    : filter.focusNode(model.name)
                }
                dark={dark}
                accentColor="indigo"
              />
            ))}
          </>
        )}

        {/* Enums */}
        {visibleEnums.length > 0 && (
          <>
            <div
              className={`px-3 pt-2 pb-0.5 text-[10px] uppercase tracking-widest ${sectionLabel}`}
            >
              Enums ({visibleEnums.length})
            </div>
            {visibleEnums.map((e) => (
              <NodeListItem
                key={e.name}
                name={e.name}
                connectionCount={0}
                isHidden={filter.hiddenNodeIds.has(e.name)}
                isFocused={false}
                onToggleHide={() => filter.toggleHideNode(e.name)}
                dark={dark}
                accentColor="emerald"
              />
            ))}
          </>
        )}

        {visibleModels.length === 0 && visibleEnums.length === 0 && (
          <p className={`px-3 pt-4 text-xs ${sectionLabel} text-center`}>
            No results for "{filter.searchQuery}"
          </p>
        )}
      </div>

      {/* ── Bottom controls ── */}
      <div className={`border-t ${divider} flex-shrink-0`}>
        {/* Layout */}
        <SectionAccordion
          label="Layout"
          open={layoutOpen}
          onToggle={() => setLayoutOpen((v) => !v)}
          dark={dark}
        >
          <div className="grid grid-cols-2 gap-1 p-2">
            {LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.dir}
                onClick={() => onLayoutChange(opt.dir)}
                title={opt.label}
                className={[
                  'flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                  selectedLayout === opt.dir ? btnActive : btnBase,
                ].join(' ')}
              >
                {opt.icon}
                {opt.dir}
              </button>
            ))}
          </div>
        </SectionAccordion>

        {/* Display */}
        <SectionAccordion
          label="Display"
          open={displayOpen}
          onToggle={() => setDisplayOpen((v) => !v)}
          dark={dark}
        >
          <div className="px-3 pb-2 space-y-2">
            <ToggleRow
              label="Minimap"
              checked={settings.showMinimap}
              onChange={(v) => updateSetting('showMinimap', v)}
              dark={dark}
            />
            <ToggleRow
              label="Background"
              checked={settings.showBackground}
              onChange={(v) => updateSetting('showBackground', v)}
              dark={dark}
            />
            <ToggleRow
              label="Field types"
              checked={settings.showFieldTypes}
              onChange={(v) => updateSetting('showFieldTypes', v)}
              dark={dark}
            />
            <ToggleRow
              label="Field icons"
              checked={settings.showFieldIcons}
              onChange={(v) => updateSetting('showFieldIcons', v)}
              dark={dark}
            />
          </div>
        </SectionAccordion>

        {/* Theme */}
        <SectionAccordion
          label="Theme"
          open={themeOpen}
          onToggle={() => setThemeOpen((v) => !v)}
          dark={dark}
        >
          <div className="px-3 pb-2 space-y-2">
            <ColorRow
              label="Primary"
              value={settings.theme.primaryColor}
              onChange={(v) => updateTheme({ primaryColor: v })}
              dark={dark}
            />
            <ColorRow
              label="Secondary"
              value={settings.theme.secondaryColor}
              onChange={(v) => updateTheme({ secondaryColor: v })}
              dark={dark}
            />
            <ColorRow
              label="Enum"
              value={settings.theme.enumColor}
              onChange={(v) => updateTheme({ enumColor: v })}
              dark={dark}
            />
            <ColorRow
              label="Title text"
              value={settings.theme.titleColor}
              onChange={(v) => updateTheme({ titleColor: v })}
              dark={dark}
            />
          </div>
        </SectionAccordion>
      </div>
    </aside>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface NodeListItemProps {
  name: string;
  connectionCount: number;
  isHidden: boolean;
  isFocused: boolean;
  onToggleHide: () => void;
  onFocus?: () => void;
  dark: boolean;
  accentColor: 'indigo' | 'emerald';
}

function NodeListItem({
  name,
  connectionCount,
  isHidden,
  isFocused,
  onToggleHide,
  onFocus,
  dark,
  accentColor,
}: NodeListItemProps) {
  const focusedStyle =
    accentColor === 'indigo'
      ? dark
        ? 'bg-indigo-950/40 text-indigo-300'
        : 'bg-indigo-50 text-indigo-700'
      : dark
        ? 'bg-emerald-950/40 text-emerald-300'
        : 'bg-emerald-50 text-emerald-700';

  const badgeStyle =
    accentColor === 'indigo'
      ? dark
        ? 'bg-indigo-900/50 text-indigo-400'
        : 'bg-indigo-100 text-indigo-600'
      : dark
        ? 'bg-emerald-900/50 text-emerald-400'
        : 'bg-emerald-100 text-emerald-600';

  return (
    <div
      className={[
        'flex items-center gap-1 px-2 py-1 mx-1 rounded-md text-xs group transition-colors',
        isFocused
          ? focusedStyle
          : dark
            ? 'hover:bg-white/5'
            : 'hover:bg-gray-50',
        isHidden ? 'opacity-40' : '',
      ].join(' ')}
    >
      {/* Hide toggle */}
      <button
        onClick={onToggleHide}
        title={isHidden ? 'Show' : 'Hide'}
        className="flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity"
      >
        {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>

      {/* Focus toggle (only for models with focus capability) */}
      {onFocus && (
        <button
          onClick={onFocus}
          title={isFocused ? 'Clear focus' : 'Focus'}
          className={[
            'flex-shrink-0 transition-opacity',
            isFocused
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-50 hover:!opacity-100',
          ].join(' ')}
        >
          <Crosshair size={12} />
        </button>
      )}

      {/* Name */}
      <span className="flex-1 truncate font-medium" title={name}>
        {name}
      </span>

      {/* Connection count badge */}
      {connectionCount > 0 && (
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeStyle}`}
        >
          {connectionCount}
        </span>
      )}
    </div>
  );
}

interface SectionAccordionProps {
  label: string;
  open: boolean;
  onToggle: () => void;
  dark: boolean;
  children: React.ReactNode;
}

function SectionAccordion({
  label,
  open,
  onToggle,
  dark,
  children,
}: SectionAccordionProps) {
  return (
    <div className={`border-b ${dark ? 'border-gray-800' : 'border-gray-100'}`}>
      <button
        onClick={onToggle}
        className={[
          'w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors',
          dark
            ? 'text-gray-400 hover:text-gray-200'
            : 'text-gray-500 hover:text-gray-700',
        ].join(' ')}
      >
        <span className="uppercase tracking-widest text-[10px]">{label}</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && children}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  dark: boolean;
}

function ToggleRow({ label, checked, onChange, dark }: ToggleRowProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: label wraps a button[role=switch], which is a valid accessible pattern
    <label className="flex items-center justify-between gap-2 cursor-pointer">
      <span className={`text-xs ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
        {label}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative w-8 h-4 rounded-full transition-colors flex-shrink-0 p-0',
          checked ? 'bg-indigo-500' : dark ? 'bg-gray-700' : 'bg-gray-200',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform',
            checked ? 'translate-x-4' : '',
          ].join(' ')}
        />
      </button>
    </label>
  );
}

interface ColorRowProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dark: boolean;
}

function ColorRow({ label, value, onChange, dark }: ColorRowProps) {
  return (
    <label className="flex items-center justify-between gap-2 cursor-pointer">
      <span className={`text-xs ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
        {label}
      </span>
      <div className="relative flex items-center gap-1.5">
        <div
          className="w-5 h-5 rounded-md border border-black/10 cursor-pointer"
          style={{ background: value }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <span
          className={`text-[10px] font-mono ${dark ? 'text-gray-500' : 'text-gray-400'}`}
        >
          {value.toUpperCase()}
        </span>
      </div>
    </label>
  );
}
