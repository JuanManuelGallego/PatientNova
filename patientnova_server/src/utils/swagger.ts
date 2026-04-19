import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'PatientNova API',
      version: '1.0.0',
      description: 'REST API for managing patients, appointments, reminders and notifications.',
    },
    servers: [{ url: '/api/v1', description: 'Default server' }],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
          description: 'HttpOnly JWT access token set at login.',
        },
      },
      schemas: {
        PaginatedMeta: {
          type: 'object',
          properties: {
            total: { type: 'integer', example: 42 },
            page: { type: 'integer', example: 1 },
            pageSize: { type: 'integer', example: 20 },
            totalPages: { type: 'integer', example: 3 },
          },
        },
        ApiError: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Resource not found' },
          },
        },
      },
    },
    security: [{ cookieAuth: [] }],
  },
  // Scan all route files for @swagger JSDoc comments
  apis: ['./src/**/*.routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
