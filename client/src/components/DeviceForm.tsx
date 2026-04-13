import React, { useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import { DeviceParameterPayload } from "../api/deviceApi";

interface DeviceFormProps {
  onSubmit: (name: string, parameters: DeviceParameterPayload[]) => Promise<void>;
  onClose?: () => void;
}

interface ParameterInput {
  name: string;
  unit: string;
}

const DeviceForm: React.FC<DeviceFormProps> = ({ onSubmit, onClose }) => {
  const [deviceName, setDeviceName] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [parameters, setParameters] = useState<ParameterInput[]>([]);
  const [currentParamName, setCurrentParamName] = useState<string>("");
  const [currentParamUnit, setCurrentParamUnit] = useState<string>("");

  const handleAddParameter = () => {
    if (!currentParamName.trim() || !currentParamUnit.trim()) {
      return;
    }
    setParameters([...parameters, { name: currentParamName.trim(), unit: currentParamUnit.trim() }]);
    setCurrentParamName("");
    setCurrentParamUnit("");
  };

  const handleRemoveParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && currentParamName.trim() && currentParamUnit.trim()) {
      e.preventDefault();
      handleAddParameter();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate sensor name
    if (!deviceName.trim()) {
      alert("Please enter a sensor name");
      return;
    }

    // Validate that at least one parameter is added
    if (parameters.length === 0) {
      alert("Please add at least one parameter with name and unit");
      return;
    }

    // Validate all parameters have both name and unit
    const invalidParams = parameters.some(p => !p.name.trim() || !p.unit.trim());
    if (invalidParams) {
      alert("All parameters must have both name and unit");
      return;
    }

    try {
      setSubmitting(true);
      // Ensure we have valid parameters
      const parametersPayload: DeviceParameterPayload[] = parameters
        .filter(p => p.name.trim() && p.unit.trim())
        .map(p => ({
          name: p.name.trim(),
          unit: p.unit.trim(),
        }));

      if (parametersPayload.length === 0) {
        alert("Please add at least one valid parameter with name and unit");
        setSubmitting(false);
        return;
      }

      await onSubmit(deviceName.trim(), parametersPayload);

      // Reset form after successful submission
      setDeviceName("");
      setParameters([]);
      setCurrentParamName("");
      setCurrentParamUnit("");

      // Close modal if onClose is provided
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error("Form submission error:", error);
      // Don't reset form on error, allow user to retry
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Device Name Section */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-foreground flex items-center gap-1.5 ml-1">
          Sensor Node Label <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="e.g., Warehouse Temp Sensor A1"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            className="w-full px-4 py-3 text-base border border-input rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-sm"
            disabled={submitting}
            required
            autoFocus
          />
        </div>
        <p className="text-xs text-muted-foreground ml-1">This label will be used to identify the node on the dashboard.</p>
      </div>

      {/* Parameters Section */}
      <div className="bg-muted/10 border border-border rounded-2xl p-5 space-y-5">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            Telemetry Parameters
          </h3>
          <p className="text-xs text-muted-foreground">Define the data points this sensor will transmit.</p>
        </div>

        {/* Add Parameter Input Row */}
        <div className="flex flex-col sm:flex-row gap-3 items-end p-4 bg-background border border-border/80 rounded-xl shadow-sm relative group hover:border-primary/30 transition-colors">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Metric Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Temperature"
              value={currentParamName}
              onChange={(e) => setCurrentParamName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-2.5 text-sm border border-input rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              disabled={submitting}
            />
          </div>
          <div className="w-full sm:w-32">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Unit <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., °C"
              value={currentParamUnit}
              onChange={(e) => setCurrentParamUnit(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-2.5 text-sm border border-input rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              disabled={submitting}
            />
          </div>
          <div className="w-full sm:w-auto">
            <button
              type="button"
              onClick={handleAddParameter}
              disabled={submitting || !currentParamName.trim() || !currentParamUnit.trim()}
              className="w-full px-6 py-2.5 text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-[0.98] flex items-center justify-center gap-1.5"
            >
              <FiPlus size={18} />
              Add
            </button>
          </div>
        </div>

        {/* Parameters List */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Configured Metrics</span>
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-bold">{parameters.length}</span>
          </h4>

          {parameters.length === 0 ? (
            <div className="py-6 border border-dashed border-border/60 rounded-xl bg-background/50 flex flex-col items-center justify-center text-center">
              <p className="text-sm text-muted-foreground font-medium">No parameters defined yet.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Add at least one metric to continue.</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5 bg-background p-3 rounded-xl border border-border/50">
              {parameters.map((param, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 pl-3 pr-1 py-1 rounded-xl bg-secondary/30 border border-border shadow-sm group hover:border-primary/40 hover:bg-secondary/50 transition-all"
                >
                  <div className="flex flex-col justify-center">
                    <span className="text-sm font-bold text-foreground leading-tight">{param.name}</span>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase">{param.unit}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveParameter(index)}
                    disabled={submitting}
                    className="p-1.5 text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors disabled:opacity-50 opacity-60 group-hover:opacity-100"
                    title="Remove parameter"
                  >
                    <FiX size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Submit Controls */}
      <div className="pt-2 flex items-center justify-between gap-4 mt-8 bg-muted/5 border-t border-border p-4 -mx-6 sm:-mx-8 px-6 sm:px-8 -mb-6 sm:-mb-8 rounded-b-3xl">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="px-6 py-2.5 text-sm font-bold text-foreground bg-muted hover:bg-accent border border-border/50 rounded-xl transition-all disabled:opacity-50 shadow-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !deviceName.trim() || parameters.length === 0}
          className="px-8 py-2.5 text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-[0.98] flex items-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
              Deploying...
            </>
          ) : (
            "Complete Deployment"
          )}
        </button>
      </div>
    </form>
  );
};

export default DeviceForm;

