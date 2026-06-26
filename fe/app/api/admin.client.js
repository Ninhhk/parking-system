import api from "./client.config";

// ===================== PARKING LOTS =====================
// Fetch all parking lots
export async function fetchParkingLots() {
    const res = await api.get("/admin/parking-lots");
    return res.data.data;
}

// Add a new parking lot
export async function addParkingLot(lot) {
    const res = await api.post("/admin/parking-lots", lot);
    return res.data.data;
}

// Update a parking lot
export async function updateParkingLot(id, lot) {
    const res = await api.put(`/admin/parking-lots/${id}`, lot);
    return res.data.data;
}

// Delete a parking lot
export async function deleteParkingLot(id) {
    const res = await api.delete(`/admin/parking-lots/${id}`);
    return res.data.data;
}

// Fetch a parking lot by ID
export async function fetchParkingLotById(id) {
    const res = await api.get(`/admin/parking-lots/${id}`);
    return res.data.data;
}

// Fetch parking sessions for a lot
export async function fetchLotParkingSessions(lotId) {
    const res = await api.get(`/admin/parking-lots/${lotId}/sessions`);
    return res.data.data;
}

// ===================== USERS =====================
// Fetch all users
export async function fetchAllUsers() {
    const res = await api.get("/admin/users");
    return res.data.data;
}

// Fetch user by ID
export async function fetchUserById(id) {
    const res = await api.get(`/admin/users/${id}`);
    return res.data.data;
}

// Create a new user (employee or admin)
export async function createUser(user) {
    const res = await api.post("/admin/users", user);
    return res.data.data;
}

// Update a user
export async function updateUser(id, user) {
    const res = await api.put(`/admin/users/${id}`, user);
    return res.data.data;
}

// Delete a user
export async function deleteUser(id) {
    const res = await api.delete(`/admin/users/${id}`);
    return res.data.data;
}

// Fetch free employees (not managing lots)
export async function fetchFreeEmployees() {
    const res = await api.get("/admin/users/free-employees");
    return res.data.data;
}

// ===================== PAYMENTS =====================
// Fetch payments with pagination
export async function fetchAllPayments({ page, pageSize, q, from, to } = {}) {
    const params = {};
    if (page) params.page = page;
    if (pageSize) params.pageSize = pageSize;
    if (q) params.q = q;
    if (from) params.from = from;
    if (to) params.to = to;
    const res = await api.get("/admin/payments", { params });
    return res.data.data;
}

// ===================== FEES =====================
// Client: Fetch all fee configurations
export async function fetchFeeConfigurations() {
    const res = await api.get("/admin/fee-config");
    return res.data.data;
}

// Client: Update a fee configuration
export async function updateFeeConfiguration(fee) {
    const res = await api.post("/admin/fee-config", {
        ticket_type: fee.ticket_type,
        vehicle_type: fee.vehicle_type,
        service_fee: fee.service_fee,
        penalty_fee: fee.penalty_fee,
    });
    return res.data.data;
}

// ===================== NOTIFICATIONS =====================
// Client: Fetch all notifications
export async function fetchNotifications() {
    const res = await api.get("/admin/notifications");
    return res.data.data;
}

// Client: Fetch a notification by ID
export async function fetchNotificationById(id) {
    const res = await api.get(`/admin/notifications/${id}`);
    return res.data.data;
}

// Client: Add a new notification
export async function addNotification(notification) {
    const res = await api.post("/admin/notifications", notification);
    return res.data.data;
}

// Client: Delete a notification
export async function deleteNotification(id) {
    const res = await api.delete(`/admin/notifications/${id}`);
    return res.data.data;
}

// ===================== LOST TICKETS =====================
// Fetch lost ticket reports (paginated)
export async function fetchAllLostTickets({ page, pageSize, q } = {}) {
    const params = {};
    if (page) params.page = page;
    if (pageSize) params.pageSize = pageSize;
    if (q) params.q = q;
    const res = await api.get("/admin/lost-tickets", { params });
    return res.data.data;
}

// Fetch a single lost ticket by session ID
export async function fetchLostTicketBySessionId(reportId) {
    const res = await api.get(`/admin/lost-tickets/${reportId}`);
    return res.data.data;
}

// Delete a lost ticket report
export async function deleteLostTicket(reportId) {
    const res = await api.delete(`/admin/lost-tickets/${reportId}`);
    return res.data.data;
}

// ===================== ANALYTICS =====================
// Fetch overall statistics
export async function fetchOverallStats() {
    const res = await api.get("/admin/analytics/stats");
    return res.data.data;
}

// Fetch revenue data by time range
export async function fetchRevenueData(timeRange = 'weekly') {
    const res = await api.get(`/admin/analytics/revenue?timeRange=${timeRange}`);
    return res.data.data;
}

// Fetch parking lot occupancy data
export async function fetchParkingLotOccupancy() {
    const res = await api.get("/admin/analytics/occupancy");
    return res.data.data;
}

// Fetch popular parking times
export async function fetchPopularTimes() {
    const res = await api.get("/admin/analytics/popular-times");
    return res.data.data;
}

// Fetch vehicle usage data
export async function fetchVehicleUsage() {
    const res = await api.get("/admin/analytics/vehicle-usage");
    return res.data.data;
}

// Fetch parking duration distribution
export async function fetchParkingDuration() {
    const res = await api.get("/admin/analytics/parking-duration");
    return res.data.data;
}

// ===================== CAMERAS =====================
// Fetch all cameras
export async function fetchCameras() {
    const res = await api.get("/admin/cameras");
    return res.data.data;
}

// Fetch available lanes from gateway config
export async function fetchAvailableLanes() {
    const res = await api.get("/admin/cameras/lanes");
    return res.data.data;
}

// Fetch camera status (with computed online/offline/disabled)
export async function fetchCameraStatus() {
    const res = await api.get("/admin/cameras/status");
    return res.data.data;
}

// Create a new camera
export async function createCamera(camera) {
    const res = await api.post("/admin/cameras", camera);
    return res.data.data;
}

// Update a camera
export async function updateCamera(id, camera) {
    const res = await api.put(`/admin/cameras/${id}`, camera);
    return res.data.data;
}

// Delete a camera
export async function deleteCamera(id) {
    const res = await api.delete(`/admin/cameras/${id}`);
    return res.data.data;
}

// Enable a module for a camera
export async function enableCameraModule(cameraId, moduleType, configJson = {}) {
    const res = await api.post(`/admin/cameras/${cameraId}/modules`, { module_type: moduleType, config_json: configJson });
    return res.data.data;
}

// Disable a module for a camera
export async function disableCameraModule(cameraId, moduleType) {
    const res = await api.delete(`/admin/cameras/${cameraId}/modules/${moduleType}`);
    return res.data.data;
}

// ===================== FEE CONFIG V2 =====================
// Fetch active fee configs for both vehicle types
export async function getActiveFeeConfigs() {
    const res = await api.get("/admin/fee-config/active");
    return res.data.data;
}

// Fetch all versions for a vehicle type
export async function getFeeConfigVersions(vehicleType) {
    const res = await api.get(`/admin/fee-config/versions?vehicle_type=${vehicleType}`);
    return res.data.data;
}

// Create a new fee config version
export async function createFeeConfigVersion(data) {
    const res = await api.post("/admin/fee-config/versions", data);
    return res.data.data;
}

// ===================== PARKING CARDS (CARD POOL) =====================
// Fetch all pool cards (Card_UID, Assigned_Lot, status, created_at)
export async function fetchParkingCards() {
    const res = await api.get("/admin/parking-cards");
    return res.data.data;
}

// Fetch pool inventory counts ({ total, available, lost })
export async function fetchCardInventory() {
    const res = await api.get("/admin/parking-cards/inventory");
    return res.data.data;
}

// Add a card to the pool ({ card_uid, lot_id }); lot_id null = Shared
export async function addParkingCard(card) {
    const res = await api.post("/admin/parking-cards", card);
    return res.data.data;
}

// Set a pool card's status ("available" | "lost")
export async function setParkingCardStatus(cardUid, status) {
    const res = await api.patch(`/admin/parking-cards/${cardUid}/status`, { status });
    return res.data.data;
}

// Delete a card from the pool
export async function deleteParkingCard(cardUid) {
    const res = await api.delete(`/admin/parking-cards/${cardUid}`);
    return res.data.data;
}

// Toggle monthly subscription state on a pool card
export async function updateCardMonthly(cardUid, { is_monthly, monthly_end_date }) {
    const res = await api.patch(`/admin/parking-cards/${cardUid}/monthly`, { is_monthly, monthly_end_date });
    return res.data.data;
}

// Fetch holder info for a card (returns null if no holder)
export async function fetchCardHolder(cardUid) {
    try {
        const res = await api.get(`/admin/parking-cards/${cardUid}/holder`);
        return res.data.data;
    } catch (err) {
        if (err.response?.status === 404) return null;
        throw err;
    }
}

// Create or update holder info for a card
export async function upsertCardHolder(cardUid, holder) {
    const res = await api.put(`/admin/parking-cards/${cardUid}/holder`, holder);
    return res.data.data;
}

// Delete holder info for a card
export async function deleteCardHolder(cardUid) {
    const res = await api.delete(`/admin/parking-cards/${cardUid}/holder`);
    return res.data.data;
}

// Fetch audit sessions (admin-namespaced — admin role guaranteed access)
export async function fetchAdminAuditSessions({ plate, sessionId, cardUid, startDate, endDate, vehicleType, lotId, status, page, pageSize } = {}) {
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

    const res = await api.get("/admin/audit/sessions", { params });
    return res.data.data;
}
