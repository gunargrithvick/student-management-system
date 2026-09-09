'use strict';

// Small error toolkit: a typed HttpError the routes can throw, an async wrapper
// so handlers don't each need try/catch, and a translator that turns MySQL
// driver errors into meaningful HTTP responses instead of a blanket 500.

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Wraps an async route handler so a rejected promise reaches Express's error
// handler instead of hanging the request.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Map MySQL driver error codes to friendly HttpErrors. Anything unrecognised is
// returned untouched so the central handler can log it and answer 500.
function translateDbError(err) {
  switch (err.code) {
    case 'ER_DUP_ENTRY':
      return new HttpError(409, 'A record with those unique values already exists.');
    case 'ER_ROW_IS_REFERENCED_2':
      return new HttpError(
        409,
        'This record is referenced by other records and cannot be deleted.',
      );
    case 'ER_NO_REFERENCED_ROW_2':
      return new HttpError(400, 'A referenced record (e.g. student or course) does not exist.');
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
      return new HttpError(400, 'A value is outside its allowed range.');
    case 'ER_DATA_TOO_LONG':
      return new HttpError(400, 'A value is too long for its field.');
    case 'ECONNREFUSED':
    case 'PROTOCOL_CONNECTION_LOST':
    case 'ER_ACCESS_DENIED_ERROR':
    case 'ENOTFOUND':
      return new HttpError(503, 'The database is temporarily unavailable. Please try again.');
    default:
      return err;
  }
}

module.exports = { HttpError, asyncHandler, translateDbError };
