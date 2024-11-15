const asyncHandler = require("express-async-handler");

// Display about page
exports.index = asyncHandler(async (req, res, next) => {
    res.render("about");
});