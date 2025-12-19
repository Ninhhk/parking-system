const analyticsRepo = require('../repositories/admin.analytics.repo');

/**
 * Service layer for analytics business logic
 */
class AnalyticsService {
    /**
     * Get overall statistics for dashboard
     */
    async getOverallStats() {
        const [revenue, users, lots, avgTime] = await Promise.all([
            analyticsRepo.getTotalRevenue(),
            analyticsRepo.getTotalUsers(),
            analyticsRepo.getTotalLots(),
            analyticsRepo.getAverageParkingTime()
        ]);

        return {
            totalRevenue: revenue.total_revenue || 0,
            totalUsers: parseInt(users.total_users) || 0,
            totalLots: parseInt(lots.total_lots) || 0,
            averageTimeMinutes: Math.round(avgTime.avg_time_minutes) || 0
        };
    }

    /**
     * Get revenue data for specified time range
     * @param {string} timeRange - 'weekly', 'monthly', or 'yearly'
     */
    async getRevenueData(timeRange) {
        if (!['weekly', 'monthly', 'yearly'].includes(timeRange)) {
            throw new Error('Invalid time range. Use weekly, monthly, or yearly.');
        }

        const data = await analyticsRepo.getRevenueByTimeRange(timeRange);
        return data;
    }

    /**
     * Get parking lot occupancy with formatted data
     */
    async getParkingLotOccupancy() {
        const data = await analyticsRepo.getParkingLotOccupancy();
        return data;
    }

    /**
     * Get popular parking times with percentages
     */
    async getPopularTimes() {
        const sessions = await analyticsRepo.getPopularTimesSessions();
        
        // Calculate percentages
        const totalSessions = sessions.reduce((sum, row) => sum + parseInt(row.session_count), 0);
        const dataWithPercentages = sessions.map(row => ({
            time_period: row.time_period,
            session_count: parseInt(row.session_count),
            percentage: totalSessions > 0 ? Math.round((parseInt(row.session_count) / totalSessions) * 100) : 0
        }));
        
        return dataWithPercentages;
    }

    /**
     * Get vehicle usage statistics
     */
    async getVehicleUsage() {
        const data = await analyticsRepo.getVehicleUsageByWeek();
        return data;
    }

    /**
     * Get parking duration distribution
     */
    async getParkingDuration() {
        const data = await analyticsRepo.getParkingDurationDistribution();
        return data;
    }
}

module.exports = new AnalyticsService();
