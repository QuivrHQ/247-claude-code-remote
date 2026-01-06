'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Zap, Globe, Eye, EyeOff, AlertCircle, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EnvironmentProvider, Environment, EnvironmentMetadata, EnvironmentIcon } from '@claude-remote/shared';
import { ENVIRONMENT_PRESETS, DEFAULT_PROVIDER_ICONS } from '@claude-remote/shared';
import { IconPicker } from './IconPicker';

interface EnvVariable {
  key: string;
  value: string;
  isSecret: boolean;
}

const providerConfig: Record<EnvironmentProvider, { icon: typeof Zap; label: string; color: string }> = {
  anthropic: { icon: Zap, label: 'Anthropic', color: 'orange' },
  openrouter: { icon: Globe, label: 'OpenRouter', color: 'emerald' },
};

interface EnvironmentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentUrl: string;
  editingEnvironment?: EnvironmentMetadata | null;
  onSaved?: () => void;
}

export function EnvironmentFormModal({
  open,
  onOpenChange,
  agentUrl,
  editingEnvironment,
  onSaved,
}: EnvironmentFormModalProps) {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<EnvironmentProvider>('anthropic');
  const [icon, setIcon] = useState<EnvironmentIcon | null>(null);
  const [variables, setVariables] = useState<EnvVariable[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load full environment data when editing
  useEffect(() => {
    if (!open) {
      // Reset form when closed
      setName('');
      setProvider('anthropic');
      setIcon(null);
      setVariables([]);
      setIsDefault(false);
      setShowSecrets({});
      setError(null);
      return;
    }

    if (editingEnvironment) {
      // Load full environment data for editing
      const loadEnvironment = async () => {
        try {
          const protocol = agentUrl.includes('localhost') ? 'http' : 'https';
          const response = await fetch(
            `${protocol}://${agentUrl}/api/environments/${editingEnvironment.id}/full`
          );
          if (response.ok) {
            const env: Environment = await response.json();
            setName(env.name);
            setProvider(env.provider);
            setIcon(env.icon);
            setIsDefault(env.isDefault);
            setVariables(
              Object.entries(env.variables).map(([key, value]) => ({
                key,
                value,
                isSecret: key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN'),
              }))
            );
          }
        } catch (err) {
          console.error('Failed to load environment:', err);
          setError('Failed to load environment data');
        }
      };
      loadEnvironment();
    } else {
      // New environment - use preset
      const preset = ENVIRONMENT_PRESETS[provider];
      setVariables(
        Object.entries(preset.defaultVariables).map(([key, value]) => ({
          key,
          value,
          isSecret: key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN'),
        }))
      );
    }
  }, [open, editingEnvironment, agentUrl, provider]);

  // Update variables when provider changes (only for new environments)
  useEffect(() => {
    if (!editingEnvironment && open) {
      const preset = ENVIRONMENT_PRESETS[provider];
      setVariables(
        Object.entries(preset.defaultVariables).map(([key, value]) => ({
          key,
          value,
          isSecret: key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN'),
        }))
      );
    }
  }, [provider, editingEnvironment, open]);

  const addVariable = () => {
    setVariables([...variables, { key: '', value: '', isSecret: false }]);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const updateVariable = (index: number, field: keyof EnvVariable, value: string | boolean) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], [field]: value };
    setVariables(updated);
  };

  // Strip markdown link format: [text](url) -> url
  const stripMarkdownLink = (value: string): string => {
    const markdownLinkRegex = /^\[([^\]]+)\]\(([^)]+)\)$/;
    const match = value.match(markdownLinkRegex);
    if (match) {
      return match[2]; // Return the URL part
    }
    return value;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(null);

    const variablesObj: Record<string, string> = {};
    variables.forEach((v) => {
      if (v.key.trim()) {
        // Clean up markdown links from values (e.g., pasted URLs)
        variablesObj[v.key.trim()] = stripMarkdownLink(v.value);
      }
    });

    try {
      const protocol = agentUrl.includes('localhost') ? 'http' : 'https';
      const url = editingEnvironment
        ? `${protocol}://${agentUrl}/api/environments/${editingEnvironment.id}`
        : `${protocol}://${agentUrl}/api/environments`;

      const response = await fetch(url, {
        method: editingEnvironment ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          provider,
          icon,
          isDefault,
          variables: variablesObj,
        }),
      });

      if (response.ok) {
        onSaved?.();
        onOpenChange(false);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save environment');
      }
    } catch (err) {
      console.error('Failed to save environment:', err);
      setError('Network error - could not connect to agent');
    } finally {
      setSaving(false);
    }
  };

  // Allow environments with no variables (for using system defaults)
  const isValid = name.trim().length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => onOpenChange(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'relative w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col',
              'bg-[#0d0d14] border border-white/10 rounded-2xl',
              'shadow-2xl shadow-black/50'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {editingEnvironment ? 'Edit Environment' : 'New Environment'}
                  </h2>
                  <p className="text-sm text-white/40">Configure API provider settings</p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-3">Provider</label>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.entries(providerConfig) as [EnvironmentProvider, typeof providerConfig.anthropic][]).map(
                    ([key, config]) => {
                      const Icon = config.icon;
                      const isSelected = provider === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setProvider(key)}
                          disabled={!!editingEnvironment}
                          className={cn(
                            'p-4 rounded-xl text-left transition-all',
                            'border',
                            isSelected
                              ? `bg-${config.color}-500/10 border-${config.color}-500/50`
                              : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20',
                            editingEnvironment && 'opacity-60 cursor-not-allowed'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Icon
                              className={cn(
                                'w-5 h-5',
                                isSelected ? `text-${config.color}-400` : 'text-white/50'
                              )}
                            />
                            <div>
                              <span
                                className={cn(
                                  'font-medium',
                                  isSelected ? 'text-white' : 'text-white/60'
                                )}
                              >
                                {config.label}
                              </span>
                              <p className="text-xs text-white/30 mt-0.5">
                                {ENVIRONMENT_PRESETS[key].description}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Name & Icon */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-white/60 mb-2">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Production, Development"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl',
                      'bg-white/5 border border-white/10',
                      'text-white placeholder:text-white/30',
                      'focus:outline-none focus:border-orange-500/50 focus:bg-white/10',
                      'transition-all'
                    )}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Icon</label>
                  <IconPicker
                    value={icon}
                    onChange={setIcon}
                    provider={provider}
                  />
                </div>
              </div>

              {/* Environment Variables */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-white/60">Environment Variables</label>
                  <div className="flex items-center gap-2">
                    {variables.length > 0 && (
                      <button
                        onClick={() => setVariables([])}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 border border-white/10 hover:border-red-500/30 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear all
                      </button>
                    )}
                    <button
                      onClick={addVariable}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Variable
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {variables.map((variable, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5"
                    >
                      <input
                        type="text"
                        value={variable.key}
                        onChange={(e) => updateVariable(index, 'key', e.target.value)}
                        placeholder="KEY_NAME"
                        className={cn(
                          'flex-1 px-3 py-2 rounded-lg font-mono text-sm',
                          'bg-white/5 border border-white/10',
                          'text-white placeholder:text-white/30',
                          'focus:outline-none focus:border-orange-500/50',
                          'transition-all'
                        )}
                      />
                      <span className="text-white/20">=</span>
                      <div className="flex-1 relative">
                        <input
                          type={variable.isSecret && !showSecrets[index] ? 'password' : 'text'}
                          value={variable.value}
                          onChange={(e) => updateVariable(index, 'value', e.target.value)}
                          placeholder={variable.isSecret ? 'sk-...' : 'value'}
                          className={cn(
                            'w-full px-3 py-2 pr-10 rounded-lg font-mono text-sm',
                            'bg-white/5 border border-white/10',
                            'text-white placeholder:text-white/30',
                            'focus:outline-none focus:border-orange-500/50',
                            'transition-all'
                          )}
                        />
                        {variable.isSecret && (
                          <button
                            onClick={() =>
                              setShowSecrets({ ...showSecrets, [index]: !showSecrets[index] })
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/60 transition-colors"
                          >
                            {showSecrets[index] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => removeVariable(index)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {variables.length === 0 && (
                    <div className="text-center py-8 text-white/30 border border-dashed border-white/10 rounded-xl">
                      <Zap className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No variables configured</p>
                      <p className="text-xs text-white/20 mt-1">Will use system environment variables</p>
                      <button
                        onClick={addVariable}
                        className="mt-3 text-orange-400 hover:text-orange-300 text-sm"
                      >
                        Add a variable
                      </button>
                    </div>
                  )}
                </div>

                {/* Warning for secrets */}
                <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-400/80">
                    API keys are stored locally on this machine and never sent to the cloud.
                  </p>
                </div>
              </div>

              {/* Default Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-orange-400" />
                  <div>
                    <p className="font-medium text-white/80">Set as default</p>
                    <p className="text-sm text-white/40">Use this environment for new sessions</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDefault(!isDefault)}
                  className={cn(
                    'w-12 h-7 rounded-full transition-all',
                    isDefault ? 'bg-orange-500' : 'bg-white/10'
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full bg-white shadow-sm transition-transform',
                      isDefault ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/5 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => onOpenChange(false)}
                className="px-4 py-2.5 rounded-xl font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!isValid || saving}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all',
                  isValid && !saving
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-lg shadow-orange-500/25'
                    : 'bg-white/5 text-white/30 cursor-not-allowed'
                )}
              >
                {saving ? 'Saving...' : editingEnvironment ? 'Save Changes' : 'Create Environment'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
