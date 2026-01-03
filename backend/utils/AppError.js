class AppError extends Error {
    constructor(code, details = null) {
        super(code); // Message is properly set in middleware based on code
        this.code = code;
        this.details = details;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
