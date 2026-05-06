from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import engine, Base
from app.models import models
from app.routers import cases, directives, dashboard, pipeline



# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="NyayaSetu API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:3000",
        "https://nyaya-setu-taupe.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cases.router, prefix="/api/v1")
app.include_router(directives.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(pipeline.router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "Welcome to NyayaSetu API"}
