const subsRepo = require('../repositories/admin.monthlysubs.repo');
const paymentsRepo = require('../repositories/admin.payments.repo');
const feeRepo = require('../repositories/admin.feeConfig.repo');
const {getCurrentTime, getDayAfterMonths} = require('../utils/date');

exports.getAllMonthlySubs = async (req, res) => {
    try {
        const monthlySubs = await subsRepo.getAllMonthlySubs();
        res.status(200).json({
            success: true,
            data: monthlySubs
        });
    } catch (error) {
        console.error('Get monthly subs error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.createMonthlySub = async (req, res) => {
    try {
        const { 
            license_plate,
            vehicle_type,
            start_date,
            months,
            owner_name,
            owner_phone,
            payment_method 
        } = req.body;

        // Validate required fields
        if (!license_plate || !vehicle_type || !start_date || !months || !owner_name || !owner_phone || !payment_method) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        const now = getCurrentTime();
        const end_date = getDayAfterMonths(start_date, months);
        const exist = await subsRepo.checkExistingSub(license_plate,start_date, end_date);
        console.log('exist:', exist);
        if(exist > 0){
            return res.status(409).json({
                success: false,
                message: 'There is an existing sub with this license plate'
            })
        }

        const newMonthlySub = await subsRepo.createMonthlySub({
            license_plate,
            vehicle_type,
            start_date,
            end_date,
            owner_name,
            owner_phone 
        });
        
        const monthlyFee = await feeRepo.getServiceFee('monthly', vehicle_type);
        
        // Check if fee config exists
        if (monthlyFee === null) {
            return res.status(400).json({
                success: false,
                message: `No fee configuration found for monthly ${vehicle_type} subscription. Please configure fees first.`
            });
        }

        const subPayment = await paymentsRepo.createMonthlyPayment({
            sub_id: newMonthlySub.sub_id,
            payment_date : now,
            payment_method: payment_method,
            total_amount: months * monthlyFee
        })

        res.status(201).json({
            success: true,
            data: {
                newMonthlySub,
                subPayment
            }
        });
    } catch (error) {
        console.error('Create monthly sub error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.deleteMonthlySub = async (req, res) => {
    try {
        const { id } = req.params;
        //console.log('controller sub_id:', id);
        const result = await subsRepo.deleteMonthlySub(id);
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Monthly subscription not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Monthly subscription deleted successfully'
        });
    } catch (error) {
        console.error('Delete monthly sub error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}