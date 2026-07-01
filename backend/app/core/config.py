from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    GOOGLE_CLIENT_ID: str
    JWT_EXPIRE_DAYS: int = 7

    class Config:
        env_file = ".env"

settings = Settings()
