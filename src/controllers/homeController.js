const asyncHandler = require("express-async-handler");

// Display home page
exports.index = asyncHandler(async (req, res, next) => {
    res.render("index", {title: "Samuel Sermons"});
});