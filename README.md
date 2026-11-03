# Kanvio – Collaborative Project Management Platform

**Organize Work. Collaborate Better. Get Things Done.**

Kanvio is a modern, full-stack project management and team collaboration platform designed to help individuals and teams organize their work, manage projects, track tasks, and collaborate efficiently through interactive Kanban boards and centralized workspaces.

##  Overview

Kanvio brings project management and team collaboration together in one place. It provides an intuitive workspace where users can manage boards, organize tasks, communicate with team members, monitor project activities, and stay updated on progress.

Built with modern web technologies, Kanvio aims to make teamwork more organized, transparent, and productive.

##  Key Features

- **Workspace Management:** Create and manage dedicated workspaces for organizing projects and teams.
- **Kanban Boards:** Organize projects visually using customizable boards and lists.
- **Task Management:** Create, assign, update, and track tasks.
- **Team Collaboration:** Work together with team members and manage shared projects.
- **Real-Time Updates:** Stay synchronized with real-time collaboration features.
- **Chat & Communication:** Facilitate communication within the workspace.
- **Activity Tracking:** Monitor recent activities and project updates.
- **My Tasks:** Access and manage your assigned tasks in one place.
- **Calendar:** View and organize scheduled tasks and deadlines.
- **Notifications & Reminders:** Stay informed about important updates and upcoming tasks.
- **Search:** Find relevant boards, tasks, and project information.
- **Authentication:** Secure user authentication and Google Sign-In integration.

##  Technology Stack

### Frontend
- React.js
- Vite
- JavaScript
- HTML5
- CSS3

### Backend
- Node.js
- Express.js
- REST APIs
- Socket.IO

### Database
- MongoDB

### Additional Technologies
- JWT Authentication
- Google OAuth
- Axios
- Git & GitHub

##  Project Structure

```text
Kanvio/
│
├── client/
│   ├── public/
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── context/
│       ├── hooks/
│       ├── pages/
│       ├── services/
│       └── utils/
│
├── server/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── sockets/
│   └── jobs/
│   ├── utils/
│   └── scripts/
│
└── README.md
```

##  Installation & Setup

### Prerequisites

Make sure you have installed:

- Node.js
- npm
- MongoDB

### 1. Clone the Repository

```bash
git clone YOUR_REPOSITORY_URL
cd Kanvio
```

### 2. Install Frontend Dependencies

```bash
cd client
npm install
```

### 3. Install Backend Dependencies

```bash
cd ../backend
npm install
```

### 4. Configure Environment Variables

Create a `.env` file inside the backend directory and configure the required environment variables.

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:5173

GOOGLE_CLIENT_ID=your_google_client_id

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email
SMTP_PASS=your_app_password
EMAIL_FROM=your_email
```

Use your actual project configuration and never upload private credentials to GitHub.

### 5. Run the Application

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend in another terminal:

```bash
cd client
npm run dev
```

Open the application at:

```text
http://localhost:5173
```

*Note: The commands assume your backend defines a `dev` script in package.json.*

##  Security

- Environment variables are used for sensitive configuration.
- Authentication is protected using JWT.
- API access is managed through backend authentication and authorization.

##  Project Goals

Kanvio aims to provide a unified platform for project organization and team productivity by combining task management, visual workflows, collaboration, and real-time communication.

## 👨 Development Status

Kanvio is an actively developed project. New features, improvements, optimizations, and enhancements are being introduced as development progresses.

##  License

This project is licensed under the MIT License, if distributed with the accompanying MIT license file.

---

**Kanvio – Organize Work. Collaborate Better. Get Things Done.**