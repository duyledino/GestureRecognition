import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from .database import engine, Base, get_db
from .models import Product
from .gestures import GestureRecognizer
import cv2
import base64
import numpy as np

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Templates
templates = Jinja2Templates(directory="app/templates")

# Initialize gesture recognizer
recognizer = GestureRecognizer()

# Middleware to add dummy data if empty
@app.on_event("startup")
def startup_event():
    db = next(get_db())
    if db.query(Product).count() == 0:
        products = [
            Product(name="Gesture Master Pro", description="Control your world with a wave of your hand.", price=299.99),
            Product(name="HoloLens Elite", description="The future of augmented reality is here.", price=1499.00),
            Product(name="Sonic Glide Mouse", description="Aerodynamic design for maximum productivity.", price=59.50),
            Product(name="Nebula Keyboard", description="RGB mechanical keyboard with cosmic switches.", price=120.00),
        ]
        db.add_all(products)
        db.commit()

@app.get("/")
def read_root(request: Request, db: Session = Depends(get_db)):
    products = db.query(Product).all()
    return templates.TemplateResponse(
        request=request, name="index.html", context={"products": products}
    )

@app.get("/product/{product_id}")
def read_product(request: Request, product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    return templates.TemplateResponse(
        request=request, name="product.html", context={"product": product}
    )

@app.websocket("/ws/gestures")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Receive frame data (base64)
            data = await websocket.receive_text()
            
            # Process frame
            try:
                gesture, landmarks = recognizer.process_frame(data)
                
                # Send back the detected gesture and landmarks
                await websocket.send_json({
                    "gesture": gesture,
                    "landmarks": landmarks
                })
            except Exception as e:
                print(f"Error processing frame: {e}")
                
    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
