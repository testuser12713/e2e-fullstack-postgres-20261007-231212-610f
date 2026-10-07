"""The single uniform error contract of the product.

Every failure — whether raised as an AppError, produced by request validation,
raised as an HTTPException or thrown unexpectedly — is rendered through the same
body shape: {"code": str, "message": str, "fields": {field: str} | null}.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    """A domain error carrying the uniform error body's fields."""

    def __init__(
        self,
        code: str,
        status: int,
        message: str,
        fields: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status = status
        self.message = message
        self.fields = fields


# HTTP status -> error code for plain HTTPExceptions (framework-generated ones).
_STATUS_CODES: dict[int, str] = {
    400: "validation_error",
    401: "not_authorized",
    403: "forbidden",
    404: "not_found",
    405: "not_found",
    409: "conflict",
    422: "validation_error",
}


def error_response(
    code: str,
    status: int,
    message: str,
    fields: dict[str, str] | None = None,
) -> JSONResponse:
    """Build the one uniform error response."""
    return JSONResponse(
        status_code=status,
        content={"code": code, "message": message, "fields": fields},
    )


async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    return error_response(exc.code, exc.status, exc.message, exc.fields)


async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    fields: dict[str, str] = {}
    for error in exc.errors():
        location = [
            str(part) for part in error.get("loc", ()) if part not in ("body", "query", "path")
        ]
        field = ".".join(location) or "body"
        message = str(error.get("msg", "invalid value"))
        fields.setdefault(field, message)
    return error_response("validation_error", 422, "The request could not be validated.", fields)


async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    code = _STATUS_CODES.get(exc.status_code, "error")
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed."
    return error_response(code, exc.status_code, detail)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled error on %s %s", request.method, request.url.path)
    return error_response("internal_error", 500, "Internal Server Error")


def register_exception_handlers(app: FastAPI) -> None:
    """Attach the handlers that render the uniform error body in every case."""
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
