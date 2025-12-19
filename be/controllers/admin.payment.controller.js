const paymentRepo = require('../repositories/admin.payment.repo');

exports.getAllPayments = async (req, res) => {
    try {
        const payments = await paymentRepo.getAllPayments();
        res.status(200).json({
            status: 'success',
            data: {
                payments: payments.rows,
            },
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
}