# Gesture-Controlled E-Commerce System

A futuristic shopping experience where you can browse products using hand gestures.

## Features
- **Real-time Gesture Recognition**: Powered by MediaPipe and FastAPI WebSockets.
- **Modern UI**: Dark mode with glassmorphism and smooth animations.
- **Database-Driven**: SQLAlchemy models with Alembic migrations for product management.
- **Gesture Mappings**:
  - ☝️ **Index Up**: Scroll Up
  - ✊ **Fist**: Scroll Down
  - 🤌 **Pinch**: Click / Select
  - ✋ **Open Palm**: Go to Home

## Project Structure
- `app/main.py`: FastAPI server, routes, and WebSocket logic.
- `app/gestures.py`: MediaPipe hand tracking and gesture classification.
- `app/models.py`: SQLAlchemy database schema.
- `app/static/`: Premium CSS and interactive JavaScript.
- `app/templates/`: Jinja2 HTML templates for Homepage and Product Detail.

## Deployment
The server is currently running at `http://localhost:8000`.

### How to use:
1. Allow camera access.
2. Position your hand in the webcam view (bottom right).
3. Use the mapping above to navigate the site!


### How to install dependencies
1. pip install -r requirements.txt >> Install dependencies
2. Start project >> python main.py 