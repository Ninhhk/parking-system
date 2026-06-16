import api from "./client.config";

export async function fetchAuditSessions({ plate, sessionId, cardUid, startDate, endDate, vehicleType, lotId, status, page, pageSize } = {}) {
    const params = {};

    if (plate) params.plate = plate;
    if (sessionId) params.sessionId = sessionId;
    if (cardUid) params.cardUid = cardUid;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (vehicleType) params.vehicleType = vehicleType;
    if (lotId) params.lotId = lotId;
    if (status) params.status = status;
    if (page) params.page = page;
    if (pageSize) params.pageSize = pageSize;

    const res = await api.get("/employee/audit/sessions", { params });
    return res.data.data;
}
