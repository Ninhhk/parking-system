const lotsRepo = require("../repositories/admin.lots.repo");

exports.getAllParkingLots = async (req, res) => {
    try {
        const parkingLots = await lotsRepo.getAllParkingLots();
        res.status(200).json({
            success: true,
            data: parkingLots,
        });
    } catch (error) {
        console.error("Get parking lots error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

exports.getParkingLotById = async (req, res) => {
    try {
        const { id } = req.params;
        const parkingLot = await lotsRepo.getParkingLotById(id);

        if (!parkingLot) {
            return res.status(404).json({
                success: false,
                message: "Parking lot not found",
            });
        }

        res.status(200).json({
            success: true,
            data: parkingLot,
        });
    } catch (error) {
        console.error("Get parking lot error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

exports.getLotParkingSessions = async (req, res) => {
    try {
        const { id } = req.params;
        const parkingSessions = await lotsRepo.getLotParkingSessions(id);

        if (!parkingSessions) {
            return res.status(404).json({
                success: false,
                message: "Parking lot not found",
            });
        }

        res.status(200).json({
            success: true,
            data: parkingSessions,
        });
    } catch (error) {
        console.error("Get parking sessions error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

exports.createParkingLot = async (req, res) => {
    try {
        const { lot_name, car_capacity, bike_capacity } = req.body;

        // Validate required fields
        if (!lot_name || !car_capacity || !bike_capacity) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
            });
        }

        const newParkingLot = await lotsRepo.createParkingLot({
            lot_name,
            car_capacity,
            bike_capacity,
        });

        res.status(201).json({
            success: true,
            data: newParkingLot,
        });
    } catch (error) {
        console.error("Create parking lot error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

exports.updateParkingLot = async (req, res) => {
    try {
        const { id } = req.params;
        const { lot_name, car_capacity, bike_capacity, managed_by } = req.body;

        // Validate required fields
        if (!lot_name || !car_capacity || !bike_capacity) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
            });
        }

        const updatedParkingLot = await lotsRepo.updateParkingLot(id, {
            lot_name,
            car_capacity,
            bike_capacity,
            managed_by,
        });

        if (!updatedParkingLot) {
            return res.status(404).json({
                success: false,
                message: "Parking lot not found",
            });
        }

        res.status(200).json({
            success: true,
            data: updatedParkingLot,
        });
    } catch (error) {
        console.error("Update parking lot error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

exports.deleteParkingLot = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedParkingLot = await lotsRepo.deleteParkingLot(id);

        if (!deletedParkingLot) {
            return res.status(404).json({
                success: false,
                message: "Parking lot not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Parking lot deleted successfully",
            data: deletedParkingLot,
        });
    } catch (error) {
        console.error("Delete parking lot error:", error);
        if (error.message === "Cannot delete parking lot with active sessions") {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};