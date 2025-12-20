# Less Wild West Forum

**COS 498 – Fall 2025 Final Project**

A secure, production-ready web forum built with **Node.js**, **Express**, **Handlebars**, **SQLite3**, and **Nginx**, containerized with **Docker**. 

---

## Overview

This project is an upgraded version of the COS498 midterm "Wild West Forum."  
Key features include:

- Persistent storage using **SQLite3**
- HTTPS setup via **Nginx Proxy Manager** with SSL/TLS
- **Password hashing** with argon2
- Account lockout after multiple failed login attempts
- User profile management and customization
- Password recovery via email
- Real-time chat with **Socket.io**
- Enhanced comment system with **pagination** and threaded replies

---

## Features

### User Authentication
- Registration and login with **email and display name**
- Logout functionality
- Account lockout after 5 failed login attempts

### User Profiles
- Update display name, email, password, avatar, bio, and color
- Profile customizations reflected in comments and chat

### Comments
- Threaded comments with replies
- Pagination (20 per page)
- Timestamps and author display names

### Real-Time Chat
- Live chat with display names, avatars, and timestamps
- Updates in real-time using Socket.io

### Security
- HTTPS encryption
- Session management via SQLite store
- Password strength validation
- Input validation and sanitization

---

## Installation and Setup

### Clone the Repository
```bash
git clone git@github.com:paigem52/Less-Wild-West-Forum.git
cd Less-Wild-West-Forum
```

### Build and Run Docker Container
```bash
docker compose build
docker compose up
```

### Access Website
In search bar: http://pdfinfoserver.org

### Stop Docker Container
```bash
docker compose down
```
### _________________
### DataBase Schena

## Users Table:
Stores all registered users and their account details

| Column Name       | Data Type       | Constraints                     | Description                               |
|------------------|----------------|---------------------------------|-------------------------------------------|
| id               | INTEGER        | PRIMARY KEY, AUTOINCREMENT      | Unique user ID                             |
| username         | TEXT           | UNIQUE, NOT NULL                | Login username                             |
| email            | TEXT           | UNIQUE, NOT NULL                | User email                                 |
| display_name     | TEXT           | NOT NULL                        | Name shown publicly                         |
| password_hash    | TEXT           | NOT NULL                        | Hashed password using argon2               |
| avatar           | TEXT           |                                 | URL or path to profile avatar              |
| bio              | TEXT           |                                 | User bio                                   |
| display_name_color | TEXT         |                                 | Hex code or predefined color for display   |
| created_at       | DATETIME       | DEFAULT CURRENT_TIMESTAMP       | Account creation timestamp                  |
| last_login       | DATETIME       |                                 | Last login timestamp                        |

### Sessions Table
Stores session data for logged-in users.

| Column Name       | Data Type       | Constraints                     | Description                               |
|------------------|----------------|---------------------------------|-------------------------------------------|
| sid              | TEXT           | PRIMARY KEY                     | Session ID                                |
| user_id          | INTEGER        | FOREIGN KEY REFERENCES Users(id) | ID of the logged-in user                  |
| data             | TEXT           |                                 | Serialized session data                    |
| expires          | DATETIME       |                                 | Session expiration timestamp               |

---

## Comments Table
Stores all user comments, including replies.

| Column Name       | Data Type       | Constraints                     | Description                               |
|------------------|----------------|---------------------------------|-------------------------------------------|
| id               | INTEGER        | PRIMARY KEY, AUTOINCREMENT      | Unique comment ID                          |
| user_id          | INTEGER        | FOREIGN KEY REFERENCES Users(id) | Author of the comment                      |
| parent_id        | INTEGER        | REFERENCES Comments(id)         | Null if top-level comment, else reply ID  |
| text             | TEXT           | NOT NULL                        | Comment content                            |
| created_at       | DATETIME       | DEFAULT CURRENT_TIMESTAMP       | Timestamp of comment creation              |

---

### Login Attempts Table
Tracks user login attempts for account lockout

| Column Name       | Data Type       | Constraints                     | Description                               |
|------------------|----------------|---------------------------------|-------------------------------------------|
| id               | INTEGER        | PRIMARY KEY, AUTOINCREMENT      | Unique attempt ID                           |
| username         | TEXT           | NOT NULL                        | Username attempted                          |
| ip_address       | TEXT           |                                 | IP address of the client                    |
| timestamp        | DATETIME       | DEFAULT CURRENT_TIMESTAMP       | Attempt time                                |
| success          | INTEGER        | NOT NULL                        | 1 if login successful, 0 if failed         |


## Environment Variables

This application supports environment variables for configuration and security.
If environment variables are not provided, the application uses safe default
values for development purposes.

For production deployments, environment variables should be explicitly set
to avoid hardcoded secrets.


### ________________________________________
### Environment Variables

| Variable Name     | Description |
|------------------|-------------|
| PORT             | Port the Express server listens on |
| SESSION_SECRET   | Secret used to sign and verify session cookies |

### SESSION_SECRET
- Used by `express-session` to protect session integrity
- Prevents session hijacking and tampering
- Should be a long, random string in production
- If not provided, the application falls back to a development-only default

### Notes
- Environment variables are accessed using `process.env`
- A `.env` file is recommended for local development but not required
- In production, values should be provided via Docker, hosting provider,
  or reverse proxy configuration

### ________________________________________
### Nginx Proxy Manager Setup
1. Install Nginx Proxy Manager in a separate Docker container.
2. Add a new Proxy Host:
  Domain Names: yourdomain.com
  Scheme: http
  Forward Hostname / IP: nodejs-container
  Forward Port: 3498
3. Enable Block Common Exploits
4. Request SSL Certificate from Let’s Encrypt
5. Ensure HTTP -> HTTPS redirection is enabled
6. Update Docker network so Node.js container is reachable by Nginx Proxy Manager

### ________________________________________
### Security Features
- Password hashing: Argon2 algorithm
- Account lockout: After 5 failed attempts, locked 15 minutes
- HTTPS: All traffic encrypted
- Session management: Stored in SQLite with secure cookies
- Input validation: Registration, profile edits, and comments
- Sanitization: Prevents XSS in comments and markdown

### ________________________________________
### API Endpoints: Authentication required
GET  /apli/chat/history
- Retrieves last 50 messages <br> <br>

POST  /apli/chat/history
- Sends new chat message

### ________________________________________
### Known Bugs/ Limitations

1. Comment threading is top-level only
2. No image uploads for avatars (URLs or predefined avatars only)
   - Bug: URL is not properly displayed (Readds during profile customization page refresh)
4. Password recovery emails not implemented
5. No admin moderation tools implemented

### Design Decisions and Trade-offs:
- SQLite3: Lightweight and persistent, ideal for project scale
- Argon2 hashing: Secure but slower; acceptable for small-scale forum
- Nginx Proxy Manager: Simplifies HTTPS in Docker environment
- Socket.io: Provides real-time chat without full websocket server management
- Markdown support: Simple parser used to prevent XSS over full feature richness

### ________________________________________
### Running Tests / Verification
- Register a new account and verify hashed password in DB
- Login attempts increment and lockout triggers after 5 failures
- Password reset flow: receive email, reset password, login
- Post comments, verify display name and customization appear
- Open chat page in multiple browsers, verify real-time updates
- Paginate comments to check navigation and count
- HTTPS verified via Nginx Proxy Manager


