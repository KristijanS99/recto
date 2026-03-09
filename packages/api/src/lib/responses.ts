import type { Context } from 'hono';
import { ERROR_CODE, HTTP_STATUS } from '../constants.js';

export function badRequest(c: Context, message: string) {
  return c.json({ error: { code: ERROR_CODE.BAD_REQUEST, message } }, HTTP_STATUS.BAD_REQUEST);
}

export function notFound(c: Context, message: string) {
  return c.json({ error: { code: ERROR_CODE.NOT_FOUND, message } }, HTTP_STATUS.NOT_FOUND);
}

export function conflict(c: Context, message: string) {
  return c.json({ error: { code: ERROR_CODE.CONFLICT, message } }, HTTP_STATUS.CONFLICT);
}

export function internalError(c: Context, message: string) {
  return c.json({ error: { code: ERROR_CODE.INTERNAL, message } }, HTTP_STATUS.INTERNAL);
}

export function serviceUnavailable(c: Context, message: string) {
  return c.json(
    { error: { code: ERROR_CODE.SERVICE_UNAVAILABLE, message } },
    HTTP_STATUS.SERVICE_UNAVAILABLE,
  );
}
