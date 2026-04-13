import React from "react";
import { FiEdit2, FiTrash2, FiCheck, FiX, FiSettings, FiPlus } from "react-icons/fi";
import { DeviceParameter, DeviceParameterPayload } from "../api/deviceApi";

interface ParameterModalProps {
  deviceName: string;
  params: DeviceParameter[];
  error: string;
  loadingParams: boolean;
  newParamName: string;
  newParamUnit: string;
  editingParamIndex: number | null;
  editingParamName: string;
  editingParamUnit: string;
  onNewParamNameChange: (v: string) => void;
  onNewParamUnitChange: (v: string) => void;
  onAddParameter: () => void;
  onEditStart: (index: number, name: string, unit: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onEditNameChange: (v: string) => void;
  onEditUnitChange: (v: string) => void;
  onRemoveParameter: (name: string, unit: string) => void;
  onClose: () => void;
}

/**
 * Parameter management modal extracted from DeviceList.tsx.
 * Handles add / inline-edit / delete of parameters for a single device.
 */
export default function ParameterModal({
  deviceName,
  params,
  error,
  loadingParams,
  newParamName,
  newParamUnit,
  editingParamIndex,
  editingParamName,
  editingParamUnit,
  onNewParamNameChange,
  onNewParamUnitChange,
  onAddParameter,
  onEditStart,
  onEditSave,
  onEditCancel,
  onEditNameChange,
  onEditUnitChange,
  onRemoveParameter,
  onClose,
}: ParameterModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-card rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-border/50 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-border bg-muted/10">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Manage Parameters</h2>
          <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-2">
            <span className="font-medium text-foreground bg-background px-2 py-0.5 rounded-md border border-border">
              {deviceName}
            </span>
            <span className="opacity-60">•</span>
            Configure available telemetry metrics
          </p>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border-l-4 border-destructive text-destructive rounded-xl text-sm font-medium shadow-sm">
              {error}
            </div>
          )}

          {/* Add New Parameter Form */}
          <div className="mb-8 p-5 bg-background rounded-2xl border border-border shadow-sm hover:border-primary/40 transition-colors">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Add New Parameter
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Parameter name (e.g., Humidity)"
                value={newParamName}
                onChange={(e) => onNewParamNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newParamName.trim()) {
                    e.preventDefault();
                    onAddParameter();
                  }
                }}
                autoComplete="off"
                className="flex-1 px-4 py-2.5 text-sm border border-input rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                disabled={loadingParams}
              />
              <input
                type="text"
                placeholder="Unit (%, °C) — optional"
                value={newParamUnit}
                onChange={(e) => onNewParamUnitChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newParamName.trim()) {
                    e.preventDefault();
                    onAddParameter();
                  }
                }}
                autoComplete="off"
                className="sm:w-36 px-4 py-2.5 text-sm border border-input rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                disabled={loadingParams}
              />
              <button
                onClick={onAddParameter}
                disabled={loadingParams || !newParamName.trim()}
                className="px-6 py-2.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap active:scale-[0.98]"
              >
                {loadingParams ? "Adding..." : "Add"}
              </button>
            </div>
          </div>

          {/* Parameters List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Current Parameters</h3>
              <span className="bg-muted text-muted-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {params.length} total
              </span>
            </div>

            {params.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/60 rounded-2xl bg-muted/10">
                <FiSettings className="w-8 h-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">No parameters defined yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {params.map((param, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-card border rounded-2xl transition-all shadow-sm hover:shadow-md ${
                      editingParamIndex === idx
                        ? "border-primary shadow-primary/10"
                        : "border-border hover:border-border/80"
                    }`}
                  >
                    {editingParamIndex === idx ? (
                      // Edit mode
                      <>
                        <div className="flex items-center gap-3 flex-1 mb-3 sm:mb-0">
                          <input
                            type="text"
                            value={editingParamName}
                            onChange={(e) => onEditNameChange(e.target.value)}
                            autoComplete="off"
                            placeholder="Name"
                            className="flex-1 px-3 py-2 text-sm font-medium border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                            disabled={loadingParams}
                          />
                          <input
                            type="text"
                            value={editingParamUnit}
                            onChange={(e) => onEditUnitChange(e.target.value)}
                            autoComplete="off"
                            placeholder="Unit"
                            className="w-24 px-3 py-2 text-sm font-medium border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                            disabled={loadingParams}
                          />
                        </div>
                        <div className="flex items-center gap-2 sm:ml-4">
                          <button
                            onClick={onEditSave}
                            disabled={loadingParams || !editingParamName.trim()}
                            className="flex-1 sm:flex-none flex justify-center items-center py-2 px-3 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Save changes"
                          >
                            <FiCheck size={18} />
                          </button>
                          <button
                            onClick={onEditCancel}
                            disabled={loadingParams}
                            className="flex-1 sm:flex-none flex justify-center items-center py-2 px-3 text-muted-foreground bg-muted hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
                            title="Cancel"
                          >
                            <FiX size={18} />
                          </button>
                        </div>
                      </>
                    ) : (
                      // View mode
                      <>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center flex-shrink-0 border border-border/50">
                            <span className="font-bold text-foreground text-sm uppercase">
                              {param.name.charAt(0)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">{param.name}</span>
                            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                              Unit: {param.unit || "N/A"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 sm:mt-0">
                          <button
                            onClick={() => onEditStart(idx, param.name, param.unit)}
                            disabled={loadingParams || editingParamIndex !== null}
                            className="flex-1 sm:flex-none flex justify-center items-center p-2.5 text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl transition-colors disabled:opacity-50"
                            title="Edit parameter"
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            onClick={() => onRemoveParameter(param.name, param.unit)}
                            disabled={loadingParams || editingParamIndex !== null}
                            className="flex-1 sm:flex-none flex justify-center items-center p-2.5 text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors disabled:opacity-50"
                            title="Remove parameter"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 sm:p-6 border-t border-border bg-muted/5 flex justify-end">
          <button
            onClick={onClose}
            disabled={loadingParams}
            className="px-6 py-2.5 font-bold text-foreground bg-muted hover:bg-accent rounded-xl transition-colors disabled:opacity-50 border border-border/50 shadow-sm w-full sm:w-auto"
          >
            Done Mapping
          </button>
        </div>
      </div>
    </div>
  );
}
