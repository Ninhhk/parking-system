const paymentRepo = require("../repositories/admin.payment.repo");

exports.getAllPayments = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const pageSize = parseInt(req.query.pageSize, 10) || 20;
        const { from, to, q } = req.query;

        const result = await paymentRepo.getPayments({ page, pageSize, from, to, q });

        return res.status(200).json({
            success: true,
            data: {
                payments: result.rows,
                pagination: {
                    page: result.page,
                    pageSize: result.pageSize,
                    totalCount: result.totalCount,
                    totalPages: result.totalPages,
                },
            },
        });
    } catch (error) {
        console.error(JSON.stringify({ event: "getAllPayments_error", message: error.message }));
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
