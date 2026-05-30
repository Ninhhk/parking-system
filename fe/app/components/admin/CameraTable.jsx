"use client";

/**
 * Camera table component for the admin camera management page.
 * Displays cameras with status indicators and supports row selection.
 *
 * @param {Object} props
 * @param {Array} props.cameras - Array of camera objects
 * @param {Array} props.statusData - Array of { camera_id, status } from /status endpoint
 * @param {string|null} props.selectedCameraId - Currently selected camera ID
 * @param {function} props.onSelectCamera - Callback when a row is clicked
 */
export default function CameraTable({ cameras = [], statusData = [], selectedCameraId, onSelectCamera }) {
    const statusMap = {};
    for (const s of statusData) {
        statusMap[s.camera_id] = s.status;
    }

    function getStatusColor(status) {
        if (status === "online") return "bg-green-500";
        if (status === "offline") return "bg-red-500";
        return "bg-gray-400";
    }

    function getModuleCount(camera) {
        if (!camera.modules) return 0;
        return camera.modules.filter((m) => m.is_enabled).length;
    }

    return (
        <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Camera Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Lane
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Direction
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Purpose
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Active
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Modules
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {cameras.map((camera) => {
                            const status = statusMap[camera.camera_id] || "offline";
                            const isSelected = camera.camera_id === selectedCameraId;

                            return (
                                <tr
                                    key={camera.camera_id}
                                    className={`cursor-pointer ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                                    onClick={() => onSelectCamera(camera.camera_id)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span
                                            className={`inline-block w-3 h-3 rounded-full ${getStatusColor(status)}`}
                                            title={status}
                                        ></span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {camera.camera_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {camera.lane_id}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {camera.direction}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {camera.purpose}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span
                                            className={`px-2 py-1 rounded text-xs font-medium ${
                                                camera.is_active
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-red-100 text-red-800"
                                            }`}
                                        >
                                            {camera.is_active ? "Yes" : "No"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {getModuleCount(camera)}
                                    </td>
                                </tr>
                            );
                        })}
                        {cameras.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                                    No cameras configured
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
