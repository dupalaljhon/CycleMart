# CycleMart Backend Setup Guide

## Node.js Backend Configuration

### Prerequisites
- Node.js (v14 or higher)
- MySQL database
- npm or yarn package manager

### Setup Steps

1. **Navigate to the backend directory**:
   ```bash
   cd CycleMart/CycleMart-api-node
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` file** with your configuration:
   ```env
   PORT=3001
   FRONTEND_URL=http://localhost:4200
   PUBLIC_BASE_URL=http://localhost:3001

   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=cyclemart
   DB_USER=root
   DB_PASSWORD=your_password

   JWT_SECRET=your_secret_key_here

   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   SMTP_FROM_EMAIL=your_email@gmail.com
   SMTP_FROM_NAME=CycleMart
   ```

5. **Ensure uploads directory exists**:
   ```bash
   mkdir -p uploads/products
   mkdir -p uploads/attachments
   mkdir -p uploads/profiles
   ```

6. **Start the server**:
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

### Verify Backend is Running

1. **Check health endpoint**:
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

2. **Check uploads directory is accessible**:
   - Place a test image in `uploads/test.jpg`
   - Access: `http://localhost:3001/uploads/test.jpg`
   - Should display the image

### Image Upload Flow

1. **Frontend sends base64 image**:
   ```typescript
   const productData = {
     product_name: "Mountain Bike",
     product_images: ["data:image/jpeg;base64,/9j/4AAQ..."],
     // ... other fields
   };
   ```

2. **Backend processes the image**:
   - Decodes base64 data
   - Generates unique filename
   - Saves to `uploads/products/` directory
   - Returns relative path: `uploads/products/prod_123456.jpg`

3. **Frontend displays the image**:
   ```typescript
   const imageUrl = `${environment.apiUploadsBaseUrl}${imagePath}`;
   // Result: http://localhost:3001/uploads/products/prod_123456.jpg
   ```

### Troubleshooting

#### Images not loading
1. Check if backend is running: `http://localhost:3001/`
2. Verify uploads directory exists and has write permissions
3. Check browser console for CORS errors
4. Verify `apiUploadsBaseUrl` in `environment.ts` matches backend URL

#### CORS errors
The backend is configured to accept requests from `http://localhost:4200` by default. If using a different port, update `FRONTEND_URL` in `.env`.

#### Database connection errors
1. Verify MySQL is running
2. Check database credentials in `.env`
3. Ensure database `cyclemart` exists
4. Run database migrations if needed

### API Endpoints

#### Products
- `GET /api/products` - Get all active products
- `POST /api/addProduct` - Add new product (requires auth)
- `PUT /api/updateProduct` - Update product (requires auth)
- `DELETE /api/deleteProduct` - Delete product (requires auth)

#### Users
- `POST /api/register` - Register new user
- `POST /api/login` - User login
- `GET /api/getUser/:id` - Get user profile
- `PUT /api/editprofile` - Update user profile (requires auth)

#### Images
- `GET /uploads/:folder/:filename` - Serve uploaded files
- Static file serving enabled for entire `/uploads` directory

### Security Notes

1. **JWT Authentication**: Most endpoints require a valid JWT token in the Authorization header:
   ```
   Authorization: Bearer <token>
   ```

2. **File Upload Limits**:
   - Images: 10MB max per file
   - Videos: 50MB max per file
   - Request body: 50MB max total

3. **Allowed File Types**:
   - Images: JPEG, PNG, GIF, WebP
   - Videos: MP4, MOV, AVI, WebM, OGG, MKV

### Production Deployment

1. **Update environment variables**:
   ```env
   PORT=3001
   FRONTEND_URL=https://your-domain.com
   PUBLIC_BASE_URL=https://api.your-domain.com
   ```

2. **Use process manager** (PM2 recommended):
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name cyclemart-api
   pm2 save
   pm2 startup
   ```

3. **Set up reverse proxy** (Nginx example):
   ```nginx
   server {
       listen 80;
       server_name api.your-domain.com;

       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       location /uploads {
           proxy_pass http://localhost:3001/uploads;
           expires 30d;
           add_header Cache-Control "public, immutable";
       }
   }
   ```

4. **Enable HTTPS** with Let's Encrypt:
   ```bash
   sudo certbot --nginx -d api.your-domain.com
   ```

### Monitoring

Check server logs:
```bash
# If using PM2
pm2 logs cyclemart-api

# If running directly
# Logs will appear in console
```

### Backup

Regularly backup:
1. Database: `mysqldump cyclemart > backup.sql`
2. Uploads directory: `tar -czf uploads-backup.tar.gz uploads/`
