# CycleMart Node.js Backend Setup

## Quick Start

### Windows
1. Double-click `START_BACKEND.bat`
2. The backend will start on `http://localhost:3001`

### Manual Start
```bash
cd CycleMart/CycleMart-api-node
npm install
npm start
```

## Configuration

### Environment Variables (.env)
The `.env` file has been created with default settings:

```env
PORT=3001
FRONTEND_URL=http://localhost:4200
PUBLIC_BASE_URL=http://localhost:3001

DB_HOST=localhost
DB_PORT=3306
DB_NAME=cyclemart
DB_USER=root
DB_PASSWORD=

JWT_SECRET=cyclemart_secret_key_2026
```

**Important:** Update `DB_PASSWORD` if your MySQL has a password.

## Image/Video Serving

The Node.js backend now serves files from TWO locations:

### 1. Primary: Node.js Uploads
- Location: `CycleMart-api-node/uploads/`
- For: New uploads from Node.js backend
- URL: `http://localhost:3001/uploads/filename.jpg`

### 2. Legacy: PHP Uploads (Backward Compatibility)
- Location: `CycleMart-api/api/uploads/`
- For: Existing images from PHP backend
- URL: `http://localhost:3001/uploads/filename.jpg`

**How it works:**
- When a request comes for `/uploads/filename.jpg`, Node.js first checks `CycleMart-api-node/uploads/`
- If not found, it falls back to `CycleMart-api/api/uploads/`
- This ensures ALL existing images continue to work!

## Directory Structure

```
CycleMart/
├── CycleMart-api-node/          # Node.js Backend (NEW)
│   ├── uploads/                 # New uploads go here
│   │   ├── products/
│   │   ├── profiles/
│   │   ├── attachments/
│   │   └── videos/
│   ├── src/
│   │   ├── server.js           # Main server file
│   │   ├── db.js               # Database connection
│   │   └── routes/
│   ├── .env                    # Environment config
│   ├── package.json
│   └── START_BACKEND.bat       # Quick start script
│
├── CycleMart-api/              # PHP Backend (LEGACY)
│   └── api/
│       └── uploads/            # Existing uploads (served by Node.js)
│           ├── prod_*.jpeg     # Product images
│           ├── profile_*.jpeg  # Profile images
│           ├── attachments/    # Message attachments
│           ├── videos/         # Product videos
│           ├── proof/          # Payment proofs
│           └── user_reports/   # Report attachments
│
└── src/                        # Angular Frontend
    └── environments/
        ├── environment.ts      # Development config
        └── environment.prod.ts # Production config
```

## Testing the Backend

### 1. Check if backend is running
```bash
curl http://localhost:3001/
```

Expected response:
```json
{
  "name": "CycleMart Node API",
  "version": "1.0.0",
  "status": "active",
  "timestamp": "2026-04-23T..."
}
```

### 2. Test image serving (existing PHP image)
```
http://localhost:3001/uploads/prod_68be381d6751a.jpeg
```

### 3. Test image serving (new Node.js image)
```
http://localhost:3001/uploads/prod_1776867655231_1jkch9ltjexi.jpg
```

## Frontend Configuration

The Angular frontend is already configured to use the Node.js backend:

**Development** (`src/environments/environment.ts`):
```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3001/api/',
  apiUploadsBaseUrl: 'http://localhost:3001/uploads/'
};
```

**Production** (`src/environments/environment.prod.ts`):
```typescript
export const environment = {
  production: true,
  apiBaseUrl: 'https://api.cyclemart.shop/api/',
  apiUploadsBaseUrl: 'https://api.cyclemart.shop/uploads/'
};
```

## Migration Strategy

### Phase 1: Dual Backend (Current)
- ✅ Node.js backend serves both new AND legacy uploads
- ✅ PHP backend can still be used if needed
- ✅ No data migration required
- ✅ Zero downtime

### Phase 2: Full Migration (Optional)
If you want to consolidate all uploads into Node.js:

```bash
# Copy all PHP uploads to Node.js
xcopy "CycleMart\CycleMart-api\api\uploads\*" "CycleMart\CycleMart-api-node\uploads\" /E /I /Y
```

Then remove the legacy path from `server.js`.

## Troubleshooting

### Backend won't start
1. Check if port 3001 is already in use:
   ```bash
   netstat -ano | findstr :3001
   ```
2. Kill the process or change PORT in `.env`

### Images not loading
1. Verify backend is running: `http://localhost:3001/`
2. Check browser console for errors
3. Verify image path in database matches file on disk
4. Check file permissions on uploads directories

### Database connection errors
1. Ensure MySQL/XAMPP is running
2. Verify database credentials in `.env`
3. Check if database `cyclemart` exists

### CORS errors
1. Verify `FRONTEND_URL` in `.env` matches your Angular dev server
2. Default is `http://localhost:4200`

## API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - User login
- `POST /api/admin/login` - Admin login

### Products
- `GET /api/all-products` - Get all active products
- `GET /api/getProduct/:id` - Get product by ID
- `POST /api/addProduct` - Add new product (requires auth)
- `PUT /api/updateProduct` - Update product (requires auth)
- `DELETE /api/deleteProduct` - Delete product (requires auth)

### Users
- `GET /api/getUser/:id` - Get user profile
- `PUT /api/editprofile` - Update user profile (requires auth)

### Uploads
- `GET /uploads/:folder/:filename` - Serve uploaded files
- Supports: images (JPEG, PNG, GIF, WebP), videos (MP4, MOV, AVI, MKV)

## Development Workflow

1. **Start MySQL/XAMPP**
   - Ensure MySQL is running on port 3306

2. **Start Node.js Backend**
   ```bash
   cd CycleMart/CycleMart-api-node
   npm start
   ```
   Or double-click `START_BACKEND.bat`

3. **Start Angular Frontend**
   ```bash
   cd CycleMart
   ng serve
   ```

4. **Access Application**
   - Frontend: `http://localhost:4200`
   - Backend API: `http://localhost:3001/api/`
   - Uploads: `http://localhost:3001/uploads/`

## Production Deployment

See `BACKEND_SETUP_GUIDE.md` for detailed production deployment instructions.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review `LISTING_MODAL_FIX.md` for image handling details
3. Check `BACKEND_SETUP_GUIDE.md` for advanced configuration
