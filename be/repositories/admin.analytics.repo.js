const { pool } = require('../config/db');

/**
 * Repository for analytics-related database queries
 */
class AnalyticsRepository {
    /**
     * Get total revenue from the last 30 days
     */
    async getTotalRevenue() {
        const query = `
            SELECT COALESCE(SUM(total_amount), 0) as total_revenue 
            FROM Payment 
            WHERE payment_date >= NOW() - INTERVAL '30 days'
        `;
        const result = await pool.query(query);
        return result.rows[0];
    }

    /**
     * Get total count of registered users
     */
    async getTotalUsers() {
        const query = `SELECT COUNT(*) as total_users FROM Users`;
        const result = await pool.query(query);
        return result.rows[0];
    }

    /**
     * Get total count of parking lots
     */
    async getTotalLots() {
        const query = `SELECT COUNT(*) as total_lots FROM ParkingLots`;
        const result = await pool.query(query);
        return result.rows[0];
    }

    /**
     * Get average parking duration in minutes for the last 30 days
     */
    async getAverageParkingTime() {
        const query = `
            SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(time_out, NOW()) - time_in))/60) as avg_time_minutes
            FROM ParkingSessions 
            WHERE time_in >= NOW() - INTERVAL '30 days'
        `;
        const result = await pool.query(query);
        return result.rows[0];
    }

    /**
     * Get revenue data grouped by time period
     * @param {string} timeRange - 'weekly', 'monthly', or 'yearly'
     */
    async getRevenueByTimeRange(timeRange) {
        let query;
        
        switch (timeRange) {
            case 'weekly':
                query = `
                    SELECT 
                        TO_CHAR(payment_date, 'Dy') as period,
                        COALESCE(SUM(total_amount), 0) as revenue
                    FROM Payment 
                    WHERE payment_date >= DATE_TRUNC('week', NOW())
                    GROUP BY DATE_TRUNC('day', payment_date), TO_CHAR(payment_date, 'Dy')
                    ORDER BY DATE_TRUNC('day', payment_date)
                `;
                break;
            case 'monthly':
                query = `
                    SELECT 
                        'Week ' || EXTRACT(WEEK FROM payment_date) - EXTRACT(WEEK FROM DATE_TRUNC('month', payment_date)) + 1 as period,
                        COALESCE(SUM(total_amount), 0) as revenue
                    FROM Payment 
                    WHERE payment_date >= DATE_TRUNC('month', NOW())
                    GROUP BY EXTRACT(WEEK FROM payment_date) - EXTRACT(WEEK FROM DATE_TRUNC('month', payment_date)) + 1
                    ORDER BY EXTRACT(WEEK FROM payment_date) - EXTRACT(WEEK FROM DATE_TRUNC('month', payment_date)) + 1
                `;
                break;
            case 'yearly':
                query = `
                    SELECT 
                        TO_CHAR(payment_date, 'Mon') as period,
                        COALESCE(SUM(total_amount), 0) as revenue
                    FROM Payment 
                    WHERE payment_date >= DATE_TRUNC('year', NOW())
                    GROUP BY EXTRACT(MONTH FROM payment_date), TO_CHAR(payment_date, 'Mon')
                    ORDER BY EXTRACT(MONTH FROM payment_date)
                `;
                break;
            default:
                throw new Error('Invalid time range. Use weekly, monthly, or yearly.');
        }
        
        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Get parking lot occupancy data for all lots
     */
    async getParkingLotOccupancy() {
        const query = `
            SELECT 
                pl.lot_name,
                pl.car_capacity + pl.bike_capacity as total_capacity,
                pl.current_car + pl.current_bike as current_occupancy,
                CASE 
                    WHEN (pl.car_capacity + pl.bike_capacity) > 0 
                    THEN ROUND((pl.current_car + pl.current_bike) * 100.0 / (pl.car_capacity + pl.bike_capacity), 2)
                    ELSE 0 
                END as occupancy_percentage
            FROM ParkingLots pl
            ORDER BY pl.lot_name
        `;
        
        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Get parking session counts grouped by time periods
     */
    async getPopularTimesSessions() {
        const query = `
            SELECT 
                CASE 
                    WHEN EXTRACT(HOUR FROM time_in) BETWEEN 6 AND 8 THEN '6am-9am'
                    WHEN EXTRACT(HOUR FROM time_in) BETWEEN 9 AND 11 THEN '9am-12pm'
                    WHEN EXTRACT(HOUR FROM time_in) BETWEEN 12 AND 14 THEN '12pm-3pm'
                    WHEN EXTRACT(HOUR FROM time_in) BETWEEN 15 AND 17 THEN '3pm-6pm'
                    WHEN EXTRACT(HOUR FROM time_in) BETWEEN 18 AND 20 THEN '6pm-9pm'
                    WHEN EXTRACT(HOUR FROM time_in) BETWEEN 21 AND 23 THEN '9pm-12am'
                    ELSE 'Other'
                END as time_period,
                COUNT(*) as session_count
            FROM ParkingSessions 
            WHERE time_in >= NOW() - INTERVAL '30 days'
            GROUP BY 
                CASE 
                    WHEN EXTRACT(HOUR FROM time_in) BETWEEN 6 AND 8 THEN '6am-9am'
                    WHEN EXTRACT(HOUR FROM time_in) BETWEEN 9 AND 11 THEN '9am-12pm'
                    WHEN EXTRACT(HOUR FROM time_in) BETWEEN 12 AND 14 THEN '12pm-3pm'
                    WHEN EXTRACT(HOUR FROM time_in) BETWEEN 15 AND 17 THEN '3pm-6pm'
                    WHEN EXTRACT(HOUR FROM time_in) BETWEEN 18 AND 20 THEN '6pm-9pm'
                    WHEN EXTRACT(HOUR FROM time_in) BETWEEN 21 AND 23 THEN '9pm-12am'
                    ELSE 'Other'
                END
            ORDER BY session_count DESC
        `;
        
        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Get vehicle usage data for the current week
     */
    async getVehicleUsageByWeek() {
        const query = `
            SELECT 
                TO_CHAR(time_in, 'Dy') as day_of_week,
                vehicle_type,
                COUNT(*) as count
            FROM ParkingSessions 
            WHERE time_in >= DATE_TRUNC('week', NOW())
            GROUP BY DATE_TRUNC('day', time_in), TO_CHAR(time_in, 'Dy'), vehicle_type
            ORDER BY DATE_TRUNC('day', time_in), vehicle_type
        `;
        
        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Get parking duration distribution for the last 30 days
     */
    async getParkingDurationDistribution() {
        const query = `
            WITH duration_calc AS (
                SELECT 
                    vehicle_type,
                    CASE 
                        WHEN time_out IS NULL THEN EXTRACT(EPOCH FROM (NOW() - time_in))/3600
                        ELSE EXTRACT(EPOCH FROM (time_out - time_in))/3600
                    END as duration_hours
                FROM ParkingSessions 
                WHERE time_in >= NOW() - INTERVAL '30 days'
            )
            SELECT 
                vehicle_type,
                CASE 
                    WHEN duration_hours < 1 THEN '< 1 hour'
                    WHEN duration_hours >= 1 AND duration_hours < 2 THEN '1-2 hours'
                    WHEN duration_hours >= 2 AND duration_hours < 4 THEN '2-4 hours'
                    WHEN duration_hours >= 4 AND duration_hours < 8 THEN '4-8 hours'
                    ELSE '8+ hours'
                END as duration_range,
                COUNT(*) as count
            FROM duration_calc
            GROUP BY 
                vehicle_type,
                CASE 
                    WHEN duration_hours < 1 THEN '< 1 hour'
                    WHEN duration_hours >= 1 AND duration_hours < 2 THEN '1-2 hours'
                    WHEN duration_hours >= 2 AND duration_hours < 4 THEN '2-4 hours'
                    WHEN duration_hours >= 4 AND duration_hours < 8 THEN '4-8 hours'
                    ELSE '8+ hours'
                END
            ORDER BY 
                vehicle_type,
                duration_range
        `;
        
        const result = await pool.query(query);
        return result.rows;
    }
}

module.exports = new AnalyticsRepository();
