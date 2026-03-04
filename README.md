
# JewelAdmin Pro - Setup Guide

This project is a high-performance Jewelry Store Admin Dashboard featuring a React frontend and a PostgreSQL backend.

## 🚀 Prerequisites

1.  **Node.js**: Download and install from [nodejs.org](https://nodejs.org/).
2.  **PostgreSQL**: Install PostgreSQL and ensure it's running on port `5432`.
3.  **pgAdmin4**: Recommended for managing your database.

## 🛠️ Database Setup (pgAdmin4)

1.  Open **pgAdmin4**.
2.  Right-click "Databases" -> **Create** -> **Database...**
3.  Name it: `jeweladmin`.
4.  Once created, right-click the `jeweladmin` database and select **Query Tool**.
5.  Open the `backend/schema.sql` file from this project.
6.  Copy the code, paste it into the Query Tool, and click the **Execute** button (Play icon).
    *   This will create your tables and the initial admin user.

## 📦 Installation

In your project folder, run the following command to install all dependencies:

```bash
npm install
```

## 🏃 Running the Application

You need two terminals open:

### Terminal 1: Backend
```bash
npm run start:dev
```
*Your backend will run at `http://localhost:3001`.*

### Terminal 2: Frontend
```bash
npm run start
```
*Your dashboard will open in the browser (usually at `http://localhost:5173`).*

## 🔑 Login Credentials

*   **Username**: `admin`
*   **Password**: `admin`

## 📂 Project Structure

*   `/backend`: Node.js/Express server and SQL schema.
*   `/components`: All React UI components.
*   `App.tsx`: Main application logic and routing.
*   `db.ts`: Frontend API client that communicates with the backend.
*   `package.json`: Project scripts and dependencies.

---
Enjoy your new Jewelry Management System!
