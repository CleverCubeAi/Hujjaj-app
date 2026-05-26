import { Request, Response, NextFunction } from 'express';

// Recursively trims leading/trailing whitespace (including tabs) from every string in req.body.
// Fixes Issue #5: pasted values like "RAM-350\t" were being saved literally and breaking search,
// sort and display. Applied globally so each controller doesn't have to remember to trim.
function trimDeep(value: any): any {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(trimDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value)) out[k] = trimDeep(value[k]);
    return out;
  }
  return value;
}

export const trimBodyMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') req.body = trimDeep(req.body);
  next();
};
