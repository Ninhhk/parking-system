"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { useUser } from "../../components/providers/UserProvider";
import PageHeader from "../../components/admin/PageHeader";
import CameraTable from "../../components/admin/CameraTable";
import CameraForm from "../../components/admin/CameraForm";
import CameraModulePanel from "../../components/admin/CameraModulePanel";
import {
    fetchCameras,
    fetchCameraStatus,
    createCamera,
    updateCamera,
    deleteCamera,
    enableCameraModule,
    disableCameraModule,
} from "../../api/admin.client";

export default function CamerasPage() {
    const router = useRouter();
    const { user } = useUser();

    const [cameras, setCameras] = useState([]);
    const [statusData, setStatusData] = useState([]);
    const [selectedCamera, setSelectedCamera] = useState(null);
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
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to enable module");
        }
    };

    const handleDisableModule = async (cameraId, moduleType) => {
        try {
            await disableCameraModule(cameraId, moduleType);
            toast.success(`Module ${moduleType} disabled`);
            loadCameras();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to disable module");
        }
    };

    const handleSelectCamera = (camera) => {
        setSelectedCamera(camera);
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
                        onSelect={handleSelectCamera}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteCamera}
                    />
                </div>

                {/* Side panel: form or module panel */}
                <div className="lg:col-span-1">
                    {formMode === "add" && (
                        <CameraForm
                            mode="add"
                            onSubmit={handleAddCamera}
                            onCancel={() => setFormMode(null)}
                        />
                    )}

                    {formMode === "edit" && selectedCamera && (
                        <CameraForm
                            mode="edit"
                            initialData={selectedCamera}
                            onSubmit={handleEditCamera}
                            onCancel={() => {
                                setFormMode(null);
                                setSelectedCamera(null);
                            }}
                        />
                    )}

                    {!formMode && selectedCamera && (
                        <CameraModulePanel
                            camera={selectedCamera}
                            onEnableModule={handleEnableModule}
                            onDisableModule={handleDisableModule}
                        />
                    )}

                    {!formMode && !selectedCamera && (
                        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                            Select a camera to view details, or click &quot;+ Add Camera&quot; to create one.
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
