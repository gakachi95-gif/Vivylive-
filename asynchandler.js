// ======================================================
// Vivy 💜 Server — utils
// Wraps an async route handler so a rejected promise reaches
// Express's error handling instead of crashing the process.
// ======================================================

function asyncHandler(fn) {

    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

}

module.exports = { asyncHandler };
