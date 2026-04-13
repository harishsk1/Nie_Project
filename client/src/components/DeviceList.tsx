import React, { useEffect, useState, useMemo } from "react";
import { FiEdit2, FiTrash2, FiCheck, FiX, FiChevronLeft, FiChevronRight, FiSettings, FiPlus } from "react-icons/fi";

import DeviceForm from "./DeviceForm";
import ParameterModal from "./ParameterModal";
import { deviceApi, DeviceParameter, DeviceParameterPayload } from "../api/deviceApi";
import { Device } from "../types/device.types";
import { formatDateTime } from "../utils/dateTime";

const ITEMS_PER_PAGE = 10;

const DeviceList: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [deviceParameters, setDeviceParameters] = useState<Map<number, DeviceParameter[]>>(new Map());
  const [managingDeviceId, setManagingDeviceId] = useState<number | null>(null);
  const [newParamName, setNewParamName] = useState<string>("");
  const [newParamUnit, setNewParamUnit] = useState<string>("");
  const [loadingParams, setLoadingParams] = useState<boolean>(false);
  const [showAddSensorModal, setShowAddSensorModal] = useState<boolean>(false);
  const [editingParamIndex, setEditingParamIndex] = useState<number | null>(null);
  const [editingParamName, setEditingParamName] = useState<string>("");
  const [editingParamUnit, setEditingParamUnit] = useState<string>("");
  const [originalParamName, setOriginalParamName] = useState<string>("");
  const [originalParamUnit, setOriginalParamUnit] = useState<string>("");

  const fetchDevices = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await deviceApi.getAll();
      setDevices(data);

      // Fetch parameters for all devices
      const paramsMap = new Map<number, DeviceParameter[]>();
      await Promise.all(
        data.map(async (device) => {
          try {
            const params = await deviceApi.getParameters(device.id);
            paramsMap.set(device.id, params);
          } catch (err) {
            console.error(`Failed to fetch parameters for device ${device.id}:`, err);
            paramsMap.set(device.id, []);
          }
        })
      );
      setDeviceParameters(paramsMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleCreate = async (name: string, parameters: DeviceParameterPayload[] = []) => {
    try {
      setError("");
      // Create the device first
      const newDevice = await deviceApi.create({ name });

      // Add parameters if any were provided
      if (parameters.length > 0) {
        try {
          const paramsPromises = parameters.map(param =>
            deviceApi.addParameter(newDevice.id, param)
          );
          await Promise.all(paramsPromises);

          // Fetch the updated parameters list
          const params = await deviceApi.getParameters(newDevice.id);
          setDeviceParameters((prev) => {
            const newMap = new Map(prev);
            newMap.set(newDevice.id, params);
            return newMap;
          });
        } catch (paramError) {
          // Device was created but parameters failed - still add device to list
          console.error("Failed to add parameters:", paramError);
          setError("Device created, but some parameters could not be added");
        }
      } else {
        // Initialize empty parameters array for the new device
        setDeviceParameters((prev) => {
          const newMap = new Map(prev);
          newMap.set(newDevice.id, []);
          return newMap;
        });
      }

      setDevices((prev) => [...prev, newDevice]);
      // Move to last page if needed
      const newTotalPages = Math.ceil((devices.length + 1) / ITEMS_PER_PAGE);
      if (newTotalPages > currentPage) {
        setCurrentPage(newTotalPages);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create device");
      throw err; // Re-throw to let the form handle it
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    try {
      setError("");
      const updatedDevice = await deviceApi.update(editingId, {
        name: editingName,
      });
      setDevices((prev) =>
        prev.map((device) => (device.id === editingId ? updatedDevice : device))
      );
      setEditingId(null);
      setEditingName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update device");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this device?")) {
      return;
    }
    try {
      setError("");
      await deviceApi.delete(id);
      setDevices((prev) => prev.filter((device) => device.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete device");
    }
  };

  const startEdit = (device: Device) => {
    setEditingId(device.id);
    setEditingName(device.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleAddParameter = async (deviceId: number) => {
    if (!newParamName.trim()) {
      setError("Parameter name is required");
      return;
    }
    try {
      setError("");
      setLoadingParams(true);
      await deviceApi.addParameter(deviceId, {
        name: newParamName.trim(),
        unit: newParamUnit.trim(),
      });
      // Refresh parameters for this device
      const params = await deviceApi.getParameters(deviceId);
      setDeviceParameters((prev) => {
        const newMap = new Map(prev);
        newMap.set(deviceId, params);
        return newMap;
      });
      setNewParamName("");
      setNewParamUnit("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add parameter");
    } finally {
      setLoadingParams(false);
    }
  };

  const handleRemoveParameter = async (deviceId: number, name: string, unit: string) => {
    if (!window.confirm(`Are you sure you want to remove parameter "${name}${unit ? ` (${unit})` : ''}"?\n\nThis will delete all data entries for this parameter.`)) {
      return;
    }
    try {
      setError("");
      setLoadingParams(true);
      await deviceApi.removeParameter(deviceId, name, unit);
      // Refresh parameters for this device
      const params = await deviceApi.getParameters(deviceId);
      setDeviceParameters((prev) => {
        const newMap = new Map(prev);
        newMap.set(deviceId, params);
        return newMap;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove parameter");
    } finally {
      setLoadingParams(false);
    }
  };

  const openParameterManagement = (deviceId: number) => {
    setManagingDeviceId(deviceId);
    setNewParamName("");
    setNewParamUnit("");
  };

  const closeParameterManagement = () => {
    setManagingDeviceId(null);
    setNewParamName("");
    setNewParamUnit("");
    setEditingParamIndex(null);
    setEditingParamName("");
    setEditingParamUnit("");
    setOriginalParamName("");
    setOriginalParamUnit("");
  };

  const startEditParameter = (index: number, name: string, unit: string) => {
    setEditingParamIndex(index);
    setEditingParamName(name);
    setEditingParamUnit(unit);
    setOriginalParamName(name);
    setOriginalParamUnit(unit);
    setError("");
  };

  const cancelEditParameter = () => {
    setEditingParamIndex(null);
    setEditingParamName("");
    setEditingParamUnit("");
    setOriginalParamName("");
    setOriginalParamUnit("");
    setError("");
  };

  const handleEditParameter = async (deviceId: number) => {
    if (!editingParamName.trim()) {
      setError("Parameter name is required");
      return;
    }

    try {
      setError("");
      setLoadingParams(true);

      // Remove old parameter
      await deviceApi.removeParameter(deviceId, originalParamName, originalParamUnit);

      // Add new parameter
      await deviceApi.addParameter(deviceId, {
        name: editingParamName.trim(),
        unit: editingParamUnit.trim(),
      });

      // Refresh parameters for this device
      const params = await deviceApi.getParameters(deviceId);
      setDeviceParameters((prev) => {
        const newMap = new Map(prev);
        newMap.set(deviceId, params);
        return newMap;
      });

      // Reset edit state
      cancelEditParameter();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to edit parameter");
    } finally {
      setLoadingParams(false);
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(devices.length / ITEMS_PER_PAGE);
  const paginatedDevices = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return devices.slice(startIndex, endIndex);
  }, [devices, currentPage]);

  // Reset to page 1 when devices change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [devices.length, currentPage, totalPages]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="w-full max-w-full min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)] bg-background py-8 px-4 sm:px-6 lg:px-8 overflow-x-hidden box-border">
      <div className="w-full max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 mb-2">
              Sensor Management
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage sensor nodes, configure parameters, and monitor fleet topology.
            </p>
          </div>
          <button
            onClick={() => setShowAddSensorModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-md font-semibold whitespace-nowrap hover:scale-[1.02]"
          >
            <FiPlus size={20} />
            Add Sensor Node
          </button>
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 border-l-4 border-destructive text-destructive rounded-xl shadow-sm">
            <p className="font-semibold text-sm mb-0.5">Operation failed</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary"></div>
            <p className="text-muted-foreground font-medium animate-pulse">Synchronizing fleet data...</p>
          </div>
        )}

        {/* Devices Grid Area */}
        {!loading && (
          <div className="w-full mt-4">
            {devices.length === 0 ? (
              <div className="bg-card rounded-2xl border border-dashed border-border/60 py-20 px-4 flex flex-col items-center justify-center text-center shadow-sm">
                <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-5 text-muted-foreground inner-shadow">
                  <FiPlus className="w-10 h-10 opacity-50" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">No sensors configured</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-8">
                  Your fleet is currently empty. Get started by adding your first sensor node to begin receiving telemetry data.
                </p>
                <button
                  onClick={() => setShowAddSensorModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all font-semibold shadow-md hover:shadow-lg"
                >
                  <FiPlus size={20} /> Deploy First Sensor
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* CSS Grid for Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedDevices.map((device, index) => {
                    const params = deviceParameters.get(device.id) || [];
                    const isEditing = editingId === device.id;

                    return (
                      <div
                        key={device.id}
                        className="bg-card rounded-2xl border border-border shadow-sm flex flex-col group hover:shadow-md hover:border-primary/30 transition-all duration-300 relative overflow-hidden"
                      >
                        {/* Visual Flair */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none transition-transform duration-500 group-hover:scale-110"></div>

                        {/* Card Header */}
                        <div className="p-5 border-b border-border bg-muted/10 relative z-10 flex flex-col justify-center min-h-[5rem]">
                          {isEditing ? (
                            <div className="flex items-center gap-2 w-full">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleUpdate();
                                  if (e.key === "Escape") cancelEdit();
                                }}
                                className="w-full px-3 py-2 text-sm font-semibold border-2 border-primary rounded-xl bg-background text-foreground focus:outline-none transition-all"
                                autoFocus
                              />
                              <button onClick={handleUpdate} className="p-2 text-emerald-600 hover:text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-colors shadow-sm"><FiCheck size={18} /></button>
                              <button onClick={cancelEdit} className="p-2 text-rose-600 hover:text-rose-700 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors shadow-sm"><FiX size={18} /></button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-lg font-bold text-foreground truncate">{device.name}</h3>
                              <span className="flex-shrink-0 text-[10px] uppercase tracking-wider font-bold text-muted-foreground bg-muted/50 border border-border px-2.5 py-1 rounded-md">
                                ID: {device.id}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Card Body - Parameters */}
                        <div className="p-5 flex-1 relative z-10 bg-background/50">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                            Configured Parameters
                            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[10px]">{params.length}</span>
                          </h4>

                          {params.length === 0 ? (
                            <div className="flex items-center justify-center p-4 border border-dashed border-border/60 rounded-xl bg-muted/20">
                              <p className="text-sm text-muted-foreground italic">No parameters defined</p>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {params.map((param, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex flex-col px-3 py-1.5 rounded-xl bg-secondary/50 text-secondary-foreground border border-border shadow-sm text-sm"
                                  title={`${param.name} (${param.unit || 'N/A'})`}
                                >
                                  <span className="font-semibold leading-tight">{param.name}</span>
                                  {param.unit && (
                                    <span className="text-[10px] text-muted-foreground font-medium uppercase mt-0.5">{param.unit}</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Card Footer - Actions */}
                        <div className="p-3 border-t border-border bg-muted/5 grid grid-cols-3 gap-2 relative z-10">
                          <button
                            onClick={() => openParameterManagement(device.id)}
                            className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 p-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl transition-colors"
                            title="Manage Parameters"
                          >
                            <FiSettings size={15} /> <span className="hidden sm:inline">Params</span>
                          </button>
                          <button
                            onClick={() => startEdit(device)}
                            disabled={isEditing}
                            className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 p-2 text-xs font-semibold text-foreground bg-muted/50 hover:bg-muted border border-border/50 rounded-xl transition-colors disabled:opacity-50"
                            title="Edit Node Name"
                          >
                            <FiEdit2 size={15} /> <span className="hidden sm:inline">Edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(device.id)}
                            className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 p-2 text-xs font-semibold flex-shrink-0 text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors"
                            title="Delete Sensor"
                          >
                            <FiTrash2 size={15} /> <span className="hidden sm:inline">Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center mt-10">
                    <div className="bg-card border border-border shadow-sm rounded-full px-2 py-1.5 flex items-center gap-1">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`p-2 rounded-full transition-all ${currentPage === 1
                          ? "text-muted-foreground cursor-not-allowed opacity-50"
                          : "text-foreground hover:bg-accent"
                          }`}
                        title="Previous Page"
                      >
                        <FiChevronLeft size={20} />
                      </button>

                      <div className="flex items-center gap-1 px-2">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <button
                                key={page}
                                onClick={() => handlePageChange(page)}
                                className={`w-9 h-9 flex items-center justify-center text-sm rounded-full font-bold transition-all ${currentPage === page
                                  ? "bg-primary text-primary-foreground shadow-md"
                                  : "text-foreground hover:bg-accent"
                                  }`}
                              >
                                {page}
                              </button>
                            );
                          } else if (page === currentPage - 2 || page === currentPage + 2) {
                            return (
                              <span key={page} className="px-1 text-muted-foreground text-sm font-medium">
                                ...
                              </span>
                            );
                          }
                          return null;
                        })}
                      </div>

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`p-2 rounded-full transition-all ${currentPage === totalPages
                          ? "text-muted-foreground cursor-not-allowed opacity-50"
                          : "text-foreground hover:bg-accent"
                          }`}
                        title="Next Page"
                      >
                        <FiChevronRight size={20} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Parameter Management Modal */}
        {managingDeviceId !== null && (() => {
          const device = devices.find(d => d.id === managingDeviceId);
          const params = deviceParameters.get(managingDeviceId) || [];
          return (
            <ParameterModal
              deviceName={device?.name ?? ""}
              params={params}
              error={error}
              loadingParams={loadingParams}
              newParamName={newParamName}
              newParamUnit={newParamUnit}
              editingParamIndex={editingParamIndex}
              editingParamName={editingParamName}
              editingParamUnit={editingParamUnit}
              onNewParamNameChange={(v) => { setNewParamName(v); if (error) setError(""); }}
              onNewParamUnitChange={(v) => { setNewParamUnit(v); if (error) setError(""); }}
              onAddParameter={() => handleAddParameter(managingDeviceId)}
              onEditStart={startEditParameter}
              onEditSave={() => handleEditParameter(managingDeviceId)}
              onEditCancel={cancelEditParameter}
              onEditNameChange={(v) => { setEditingParamName(v); if (error) setError(""); }}
              onEditUnitChange={(v) => { setEditingParamUnit(v); if (error) setError(""); }}
              onRemoveParameter={(name, unit) => handleRemoveParameter(managingDeviceId, name, unit)}
              onClose={closeParameterManagement}
            />
          );
        })()}

        {/* Add Sensor Modal */}

        {showAddSensorModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowAddSensorModal(false);
              }
            }}
          >
            <div
              className="bg-card rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-border/50 animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 sm:p-8 border-b border-border bg-muted/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 bg-primary/5 blur-2xl rounded-bl-full"></div>
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">
                      Deploy New Sensor
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1.5 font-medium">
                      Configure details and telemetry parameters for your new node
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddSensorModal(false)}
                    className="p-2 text-muted-foreground hover:text-foreground bg-background hover:bg-accent rounded-full border border-border shadow-sm transition-all"
                    aria-label="Close modal"
                  >
                    <FiX size={20} />
                  </button>
                </div>
              </div>

              <div className="p-6 sm:p-8 overflow-y-auto flex-1 style-scrollbars">
                <DeviceForm
                  onSubmit={handleCreate}
                  onClose={() => setShowAddSensorModal(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceList;
