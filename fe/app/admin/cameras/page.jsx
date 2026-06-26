"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { useUser } from "../../components/providers/UserProvider";
import PageHeader from "../../components/admin/PageHeader";
import CameraTable from "../../components/admin/CameraTable";
import CameraForm from "../../components/admin/CameraForm";
import CameraModulePanel from "../../components/admin/CameraModulePanel";
import CameraLivePreview from "../../components/admin/CameraLivePreview";
import {
    fetchCameras,
    fetchCameraStatus,
    fetchAvailableLanes,
    createCamera,
    updateCamera,
    deleteCamera,
    enableCameraModule,
    disableCameraModule,
} from "../../api/admin.client";

const AVAILABLE_MODULES = ["LPD"];

export default function CamerasPage() {
    const router = useRouter();
    const { user } = useUser();

    const [cameras, setCameras] = useState([]);
    const [statusData, setStatusData] = useState([]);
    const [lanes, setLanes] = useState([]);
    const [selectedCamera, setSelectedCamera] = useState(null);
    const [cameraModules, setCameraModules] = useState([]);
    const [formMode, setFormMode] = useState(null); // null | "add" | "edit"
    const [loading, setLoading] = useState(true);

    // Role-based redirect for non-admin users
    useEffect(() => {
        if (user && user.role !== "admin") {
            router.replace("/employee");
        }
    }, [user, router]);

    // Fetch cameras on mount
    const loadCameras = useCallback(async () => {
        try {
            const data = await fetchCameras();
            setCameras(data);
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to load cameras");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCameras();
    }, [loadCameras]);

    // Fetch available lanes on mount
    useEffect(() => {
        fetchAvailableLanes()
            .then(setLanes)
            .catch(() => setLanes([]));
    }, []);

    // Poll /status every 30 seconds
    useEffect(() => {
        const pollStatus = async () => {
            try {
                const data = await fetchCameraStatus();
                setStatusData(data);
            } catch {
                // Silent fail for polling — don't spam toasts
            }
        };

        pollStatus();
        const interval = setInterval(pollStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    // Handlers
    const handleAddCamera = async (formData) => {
        try {
            await createCamera(formData);
            toast.success("Camera created");
            setFormMode(null);
            loadCameras();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to create camera");
        }
    };

    const handleEditCamera = async (formData) => {
        try {
            await updateCamera(selectedCamera.camera_id, formData);
            toast.success("Camera updated");
            setFormMode(null);
            setSelectedCamera(null);
            loadCameras();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to update camera");
        }
    };

    const handleDeleteCamera = async (cameraId) => {
        try {
            await deleteCamera(cameraId);
            toast.success("Camera deleted");
            if (selectedCamera?.camera_id === cameraId) {
                setSelectedCamera(null);
            }
            loadCameras();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to delete camera");
        }
    };

    const handleEnableModule = async (cameraId, moduleType) => {
        try {
            await enableCameraModule(cameraId, moduleType);
            toast.success(`Module ${moduleType} enabled`);
            loadCameras();
            return true;
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to enable module");
            return false;
        }
    };

    const handleDisableModule = async (cameraId, moduleType) => {
        try {
            await disableCameraModule(cameraId, moduleType);
            toast.success(`Module ${moduleType} disabled`);
            loadCameras();
            return true;
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to disable module");
            return false;
        }
    };

    const handleToggleModule = async (cameraId, moduleType, enable) => {
        if (enable) {
            return handleEnableModule(cameraId, moduleType);
        }
        return handleDisableModule(cameraId, moduleType);
    };

    const handleSelectCamera = (camera) => {
        setSelectedCamera(camera);
        setCameraModules(camera.modules || []);
        setFormMode(null);
    };

    const handleEditClick = (camera) => {
        setSelectedCamera(camera);
        setFormMode("edit");
    };

    // Don't render for non-admin
    if (user && user.role !== "admin") {
        return null;
    }

    return (
        <>
            <PageHeader
                title="Camera Management"
                buttonText="+ Add Camera"
                onButtonClick={() => {
                    setFormMode("add");
                    setSelectedCamera(null);
                }}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Camera table — takes 2 cols on large screens */}
                <div className="lg:col-span-2">
                    <CameraTable
                        cameras={cameras}
                        statusData={statusData}
                        loading={loading}
                        selectedCameraId={selectedCamera?.camera_id}
                        onSelectCamera={(cameraId) => {
                            const cam = cameras.find((c) => c.camera_id === cameraId);
                            if (cam) handleSelectCamera(cam);
                        }}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteCamera}
                    />
                </div>

                {/* Side panel: form or module panel */}
                <div className="lg:col-span-1">
                    {formMode === "add" && (
                        <CameraForm
                            mode="add"
                            lanes={lanes}
                            onSubmit={handleAddCamera}
                            onCancel={() => setFormMode(null)}
                        />
                    )}

                    {formMode === "edit" && selectedCamera && (
                        <CameraForm
                            mode="edit"
                            lanes={lanes}
                            initialData={selectedCamera}
                            onSubmit={handleEditCamera}
                            onCancel={() => {
                                setFormMode(null);
                                setSelectedCamera(null);
                            }}
                        />
                    )}

                    {!formMode && selectedCamera && (
                        <div className="space-y-4">
                            <CameraLivePreview camera={selectedCamera} />
                            <CameraModulePanel
                                camera={selectedCamera}
                                modules={cameraModules}
                                availableModules={AVAILABLE_MODULES}
                                onToggleModule={handleToggleModule}
                                onDeleteCamera={handleDeleteCamera}
                            />
                        </div>
                    )}

                    {!formMode && !selectedCamera && (
                        <div className="bg-white rounded-lg shadow p-6 text-center text-slate-500">
                            Select a camera to view details, or click &quot;+ Add Camera&quot; to create one.
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
