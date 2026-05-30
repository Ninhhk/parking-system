import api from "./client.config";

export async function fetchAuditSessions({ plate, startDate, endDate, vehicleType, lotId, page, pageSize } = {}) {
    const params = {};

    if (plate) params.plate = plate;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (vehicleType) params.vehicleType = vehicleType;
    if (lotId) params.lotId = lotId;
    if (page) params.page = page;
    if (pageSize) params.pageSize = pageSize;

    const res = await api.get("/employee/audit/sessions", { params });
    return res.data.data;
}
