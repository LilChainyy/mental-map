import { COLOR_PRESETS } from '../types';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div>
      <div className="flex gap-1.5 mb-2">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.hex}
            type="button"
            onClick={() => onChange(preset.hex)}
            title={preset.name}
            className="w-6 h-6 rounded-full cursor-pointer shrink-0"
            style={{
              backgroundColor: preset.hex,
              boxShadow: value === preset.hex ? `0 0 0 2px white, 0 0 0 3.5px ${preset.hex}` : 'none',
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 cursor-pointer border-0 p-0 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const hex = e.target.value;
            if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
              onChange(hex);
            }
          }}
          className="border border-gray-300 rounded px-2 py-0.5 text-xs w-20 font-mono"
          placeholder="#9CA3AF"
        />
      </div>
    </div>
  );
}
