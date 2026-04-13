// const asyncHandler = (requestHandler) => {
//   return (req, res, next) => {
//     Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
//   };
// };

// export { asyncHandler };
// ============================================

import { Request, Response, NextFunction, RequestHandler } from "express";

// Define type for async request handler functions
type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

const asyncHandler = (requestHandler: AsyncRequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

export { asyncHandler };
