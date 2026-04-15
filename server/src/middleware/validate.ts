import { Context, Next } from "hono";
import { ZodSchema, ZodError } from "zod";
import type { AppEnv } from "../types.js";

export function validate(schema: ZodSchema) {
  return async (c: Context<AppEnv>, next: Next) => {
    try {
      const body = await c.req.json();
      const parsed = schema.parse(body);
      c.set("validatedBody", parsed);
      await next();
    } catch (err) {
      if (err instanceof ZodError) {
        return c.json(
          {
            success: false,
            error: "Validation failed",
            details: err.errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          },
          422
        );
      }
      return c.json({ success: false, error: "Invalid request body" }, 400);
    }
  };
}
