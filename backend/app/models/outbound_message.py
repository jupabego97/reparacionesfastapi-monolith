from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Text

from app.core.database import Base


class OutboundMessage(Base):
    """Mensajes salientes (p. ej. WhatsApp) para trazabilidad e idempotencia."""

    __tablename__ = "outbound_messages"
    __table_args__ = (
        Index("ix_outbound_messages_tarjeta_event_status", "tarjeta_id", "event", "status"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tarjeta_id = Column(Integer, ForeignKey("repair_cards.id", ondelete="CASCADE"), nullable=False, index=True)
    channel = Column(Text, nullable=False, default="whatsapp")
    event = Column(Text, nullable=False)
    recipient = Column(Text, nullable=False)
    status = Column(Text, nullable=False)
    provider_message_id = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), index=True)
