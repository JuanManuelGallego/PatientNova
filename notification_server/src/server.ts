import app from "./app.js";
import { config } from "./config.js";
import { logger } from "./logger.js";

app.listen(config.port, () => {
  logger.info(`Server running on http://localhost:${config.port}`);
  logger.info(`Environment: ${process.env.NODE_ENV ?? "development"}`);
});