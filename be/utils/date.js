/**
 * Date utilities for parking lot system
 * 
 * The TZ environment variable should be set to 'Asia/Ho_Chi_Minh' (UTC+7)
 * in the Docker container for correct timezone handling.
 */

/**
 * Gets today's date in YYYY-MM-DD format (local timezone)
 */
function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets current datetime in 'YYYY-MM-DD HH:MM:SS' format (local timezone)
 */
function getCurrentTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getDayAfterMonths(start_date, months) {
  const date = new Date(start_date);
  date.setMonth(date.getMonth() + months);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateHoursDifference(startDate, endDate) {
  const diffMs = Math.abs(endDate - startDate);
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours;
}

function calculateHoursDifferenceCeil(startDate, endDate) {
  const diffMs = endDate - startDate;
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.ceil(diffHours);
}

module.exports = {
  getToday,
  getCurrentTime,
  getDayAfterMonths,
  calculateHoursDifference,
  calculateHoursDifferenceCeil
};
