// Middleware để kiểm tra nếu người dùng đã đăng nhập
function isAuthenticated(req, res, next) {
    if (req.session.user) {
    return next();  // Nếu người dùng đã đăng nhập, tiếp tục xử lý yêu cầu
  } else {
    return res.status(401).json({ message: 'Unauthorized. Please log in.' });  // Trả về lỗi nếu chưa đăng nhập
  }
}

// Middleware kiểm tra quyền (role) của người dùng
function hasRole(roles) {
  return (req, res, next) => {
    if (req.session.user && roles.includes(req.session.user.role)) {
      return next();  // Nếu người dùng có quyền truy cập
    } else {
      return res.status(403).json({ message: 'Forbidden. You do not have the required permissions.' });  // Trả về lỗi nếu không có quyền
    }
  };
}

// Middleware to check if user is already logged in
function isNotAuthenticated(req, res, next) {
  if (req.session.user) {
      return res.status(400).json({ 
          success: false, 
          message: "You are already logged in. Please logout first." 
      });
  }
  next();
}

module.exports = { isAuthenticated, hasRole, isNotAuthenticated };
