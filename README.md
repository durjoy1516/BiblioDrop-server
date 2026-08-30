🚀 BiblioDrop Server

The Node.js + Express.js + MongoDB backend API for BiblioDrop — an online book delivery management system.

🌐 Links

Live API: https://biblio-drop-server-two.vercel.app

Server Repo: https://github.com/durjoy1516/BiblioDrop-server

Client Repo: https://github.com/durjoy1516/BiblioDrop-client

✨ Key Features

🔐 JWT authentication with protected API routes

👥 Role-based authorization

📚 Book CRUD & admin approval workflow

💳 Stripe payment integration

🚚 Delivery management and status tracking

⭐ Verified review system

👤 User profile management

📊 Admin statistics & category analytics

🔎 Search, filtering & server-side pagination

🗄️ MongoDB Atlas database

🖼️ ImgBB image hosting support

🌍 Production-ready CORS configuration

🛠️ Tech Stack

Node.js

Express.js

MongoDB

Mongoose

JWT

bcrypt

Stripe

dotenv

CORS

🔄 Delivery Flow

Librarian → Add Book → Pending Approval
        ↓
Admin → Approve → Published
        ↓
Reader → Stripe Payment
        ↓
Pending → Dispatched → Delivered
        ↓
Verified Review

🚀 Run Locally

npm install
npm run dev

Create .env with:

PORT=5000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
CLIENT_URL=http://localhost:3000

Never commit .env or secret keys to GitHub.

👨‍💻 Developer

Durjoy — Full-Stack Web Developer