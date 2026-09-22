import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/app";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { requestLogger } from "./middleware/logger.middleware";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger";

// add here - after imports, before app setup
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

const app: Application = express();

// Middleware
app.use(helmet());
// get list of cors urls from .env file
const corsUrls = config.corsOrigin === "*" ? "*" : config.corsOrigin.split(",").map(url => url.trim());
app.use(cors({ origin: corsUrls }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);


// Routes
app.use("/api/v1", routes);

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📝 Environment: ${config.nodeEnv}`);
  console.log(`🔗 API: http://localhost:${PORT}/api/v1`);
  console.log(`💚 Health: http://localhost:${PORT}/api/v1/health`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
});

export default app;