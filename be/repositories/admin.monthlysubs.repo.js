const { pool } = require('../config/db');

exports.getAllMonthlySubs = async() => {
    result = await pool.query(`SELECT sub_id, license_plate, vehicle_type,
                                start_date::text AS start_date,
                                end_date::text AS end_date,
                                owner_name, owner_phone FROM MonthlySubs`);
    return result.rows;
}

exports.createMonthlySub = async (data) => {
    const {
        license_plate,
        vehicle_type,
        start_date,
        end_date,
        owner_name,
        owner_phone
    } = data;

    const query = `
        INSERT INTO MonthlySubs (
            license_plate,
            vehicle_type,
            start_date,
            end_date,
            owner_name,
            owner_phone
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING sub_id, license_plate, vehicle_type, 
        start_date::text AS start_date, 
        end_date::text AS end_date,
        owner_name, owner_phone
    `;

    const result = await pool.query(query,[
        license_plate,
        vehicle_type,
        start_date,
        end_date,
        owner_name,
        owner_phone
    ]);
    return result.rows[0];
};

exports.checkExistingSub = async(license_plate, start_check, end_check) => {
    const query = `
        SELECT COUNT(*) FROM MonthlySubs
        WHERE license_plate = $1 AND 
        ((start_date >= $2 AND start_date < $3) OR (end_date > $2 AND end_date <= $3) OR
        (start_date < $2 AND end_date > $3))
    `;
    const result = await pool.query(query,[license_plate, start_check, end_check]);
    return result.rows[0].count;
}

exports.deleteMonthlySub = async (sub_id) => {
    const query = `DELETE FROM MonthlySubs WHERE sub_id = $1 RETURNING *`;
    const result = await pool.query(query, [sub_id]);
    //console.log('sub_id:', sub_id);
    return result.rows;
}