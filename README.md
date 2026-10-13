# Admin Service - Node.js Express Prisma PostgreSQL

A production-ready Node.js REST API built with Express, Prisma ORM, and PostgreSQL, featuring TypeScript and a well-organized folder structure.

## 📁 Project Structure

```
admin-service/
├── prisma/
│   └── schema.prisma          # Prisma schema and models
├── src/
│   ├── config/                # Configuration files
│   │   ├── app.ts            # Application configuration
│   │   └── database.ts       # Prisma client setup
│   ├── controllers/           # Route handlers
│   │   └── user.controller.ts
│   ├── services/              # Business logic
│   │   └── user.service.ts
│   ├── interfaces/            # TypeScript interfaces
│   │   ├── user.interface.ts
│   │   └── common.interface.ts
│   ├── middleware/            # Express middleware
│   │   ├── error.middleware.ts
│   │   ├── validation.middleware.ts
│   │   └── logger.middleware.ts
│   ├── models/                # Model utilities
│   │   └── index.ts
│   ├── routes/                # API routes
│   │   ├── index.ts
│   │   └── user.routes.ts
│   ├── validations/           # Input validation schemas
│   │   └── user.validation.ts
│   ├── utils/                 # Utility functions
│   │   └── response.util.ts
│   ├── helpers/               # Helper functions
│   │   ├── date.helper.ts
│   │   └── string.helper.ts
│   └── index.ts               # Application entry point
├── .env.example               # Environment variables template
├── .gitignore
├── nodemon.json
├── package.json
└── tsconfig.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn

### Installation

1. **Clone the repository** (or navigate to the project directory)

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and update the database connection string:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/database_name?schema=public"
   ```

4. **Generate Prisma Client**
   ```bash
   npm run prisma:generate
   ```

5. **Run database migrations**
   ```bash
   npm run prisma:migrate
   ```

### Development

Start the development server with auto-reload:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Production

Build the TypeScript code:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## Swagger Docs

The API documentation is available at `http://localhost:3000/api-docs`

## 📚 API Endpoints

### Health Check
- `GET /api/health` - Check server status

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create a new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Example Request

**Create User:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "password": "SecurePass123"
  }'
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server with nodemon
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## 🏗️ Architecture

### Folder Descriptions

- **config/** - Application and database configuration
- **controllers/** - Handle HTTP requests and responses
- **services/** - Business logic and data operations
- **interfaces/** - TypeScript type definitions
- **middleware/** - Express middleware (auth, validation, error handling)
- **models/** - Model transformation utilities
- **routes/** - API route definitions
- **validations/** - Input validation schemas using express-validator
- **utils/** - General utility functions
- **helpers/** - Specific helper functions (date, string manipulation)

### Design Patterns

- **Layered Architecture**: Controllers → Services → Database
- **Dependency Injection**: Services are injected into controllers
- **Error Handling**: Centralized error handling middleware
- **Validation**: Input validation using express-validator
- **Type Safety**: Full TypeScript support with strict mode

## 🔒 Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Input Validation**: Request validation using express-validator
- **Error Handling**: Safe error messages (no stack traces in production)

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `CORS_ORIGIN` | Allowed CORS origin | `*` |
| `JWT_SECRET` | JWT secret key (if using auth) | - |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` |

## 🧪 Database Management

### View Database
```bash
npm run prisma:studio
```

### Create Migration
```bash
npx prisma migrate dev --name migration_name
```

### Reset Database
```bash
npx prisma migrate reset
```

## 📦 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Validation**: express-validator
- **Security**: Helmet, CORS

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

ISC
