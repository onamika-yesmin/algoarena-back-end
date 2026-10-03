import type { NextFunction, Request, Response } from "express";
import { ZodError, type AnyZodObject } from "zod";
import { AppError } from "../utils/errors.js";

export const validateRequest =
  (schema: AnyZodObject) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        cookies: req.cookies,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        const message = issue ? issue.message : "Validation error";
        return next(new AppError(message, 400));
      }
      return next(error);
    }
  };
