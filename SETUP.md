# CASH Application - Setup Guide

## Prerequisites
- ✅ MySQL installed
- ✅ Node.js installed

## Quick Setup

### Option 1: Automated Setup (Recommended)

1. **Run the setup script**:
   ```bash
   cd database
   setup-complete.bat
   ```

2. **Edit the .env file**:
   - Open `backend\.env`
   - Set your MySQL password: `DB_PASSWORD=your_password`

3. **Start the servers**:
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev

   # Terminal 2 - Frontend  
   cd ..
   npm run dev
   ```

### Option 2: Manual Setup

#### 1. Initialize Database
```bash
cd database
mysql -u root -p < init.sql
```

#### 2. Setup Backend
```bash
cd ../backend

# Copy environment file
copy .env.example .env

# Edit .env and set your MySQL password
notepad .env

# Install dependencies
npm install

# Start backend server
npm run dev
```

#### 3. Start Frontend
```bash
cd ..
npm run dev
```

## Verify Setup

1. **Backend Health Check**:
   - Open: http://localhost:3001/health
   - Should see: `{"status":"OK"}`

2. **Test API**:
   - Open: http://localhost:3001/api/tipo-entrada
   - Should see JSON array with tree data

3. **Frontend**:
   - Open: http://localhost:5173
   - Click "Tipo Entrada" in sidebar
   - Data should now load from MySQL!

## API Endpoints

- `GET /api/tipo-entrada` - Get all nodes
- `GET /api/tipo-entrada/tree` - Get tree structure
- `POST /api/tipo-entrada` - Create node
- `PUT /api/tipo-entrada/:id` - Update node
- `DELETE /api/tipo-entrada/:id` - Delete node
- `PUT /api/tipo-entrada/:id/move` - Move node

## Troubleshooting

### Database Connection Error
- Check MySQL is running
- Verify password in `backend/.env`
- Check port 3306 is not blocked

### Backend Won't Start
- Run `npm install` in backend folder
- Check port 3001 is available

### Frontend Can't Connect
- Ensure backend is running on port 3001
- Check browser console for CORS errors
