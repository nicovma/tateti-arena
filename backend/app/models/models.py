import enum
import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, Enum as SAEnum, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class GameStatus(enum.Enum):
    waiting = "waiting"
    in_progress = "in_progress"
    finished = "finished"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    avatar_url = Column(String)
    wins = Column(Integer, default=0, nullable=False)
    losses = Column(Integer, default=0, nullable=False)
    draws = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    games_as_x = relationship("Game", foreign_keys="Game.player_x_id", back_populates="player_x")
    games_as_o = relationship("Game", foreign_keys="Game.player_o_id", back_populates="player_o")


class Game(Base):
    __tablename__ = "games"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    player_x_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    player_o_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    winner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(SAEnum(GameStatus), default=GameStatus.waiting, nullable=False)
    board = Column(String(9), default=" " * 9, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)

    player_x = relationship("User", foreign_keys=[player_x_id], back_populates="games_as_x")
    player_o = relationship("User", foreign_keys=[player_o_id], back_populates="games_as_o")
