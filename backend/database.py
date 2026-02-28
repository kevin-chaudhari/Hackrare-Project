# database.py — SQLite database setup with SQLAlchemy
import json
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, String, Float, Integer,
    DateTime, Boolean, Text, ForeignKey, Index
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DATABASE_URL = "sqlite:///./raresignal.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Patient(Base):
    __tablename__ = "patients"
    id = Column(String, primary_key=True, index=True)
    disease = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    disease_config_json = Column(Text, nullable=True)  # optional overrides

    entries = relationship("SymptomEntry", back_populates="patient", cascade="all, delete-orphan")
    baseline = relationship("BaselineProfile", back_populates="patient", uselist=False, cascade="all, delete-orphan")
    signals = relationship("ComputedSignal", back_populates="patient", cascade="all, delete-orphan")
    fis_scores = relationship("FunctionalScore", back_populates="patient", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="patient", cascade="all, delete-orphan")


class SymptomEntry(Base):
    __tablename__ = "symptom_entries"
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    timestamp = Column(DateTime, nullable=False, index=True)
    symptoms_json = Column(Text, nullable=False)   # JSON: {symptom: 0-10}
    triggers_json = Column(Text, nullable=False, default="[]")  # JSON: [trigger_name]
    notes = Column(Text, nullable=True)

    patient = relationship("Patient", back_populates="entries")

    __table_args__ = (
        Index("idx_entries_patient_time", "patient_id", "timestamp"),
    )

    @property
    def symptoms(self):
        return json.loads(self.symptoms_json)

    @property
    def triggers(self):
        return json.loads(self.triggers_json)


class BaselineProfile(Base):
    __tablename__ = "baseline_profiles"
    patient_id = Column(String, ForeignKey("patients.id"), primary_key=True)
    mu_json = Column(Text, default="{}")        # JSON: {symptom: ewma_mean}
    sigma_json = Column(Text, default="{}")     # JSON: {symptom: ewma_std}
    n_observations = Column(Integer, default=0)
    last_updated = Column(DateTime, default=datetime.utcnow)
    alpha = Column(Float, default=0.1)

    patient = relationship("Patient", back_populates="baseline")

    @property
    def mu(self):
        return json.loads(self.mu_json)

    @property
    def sigma(self):
        return json.loads(self.sigma_json)


class ComputedSignal(Base):
    __tablename__ = "computed_signals"
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    computed_at = Column(DateTime, default=datetime.utcnow, index=True)
    z_scores_json = Column(Text, default="{}")
    volatility_index = Column(Float, nullable=True)
    flare_acceleration = Column(Float, nullable=True)
    trigger_correlations_json = Column(Text, default="{}")
    data_completeness = Column(Float, nullable=True)
    risk_category = Column(String, default="INSUFFICIENT_DATA")
    signals_suppressed_json = Column(Text, default="[]")

    patient = relationship("Patient", back_populates="signals")

    __table_args__ = (
        Index("idx_signals_patient_time", "patient_id", "computed_at"),
    )

    @property
    def z_scores(self):
        return json.loads(self.z_scores_json)

    @property
    def trigger_correlations(self):
        return json.loads(self.trigger_correlations_json)

    @property
    def signals_suppressed(self):
        return json.loads(self.signals_suppressed_json)


class FunctionalScore(Base):
    __tablename__ = "functional_scores"
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    computed_at = Column(DateTime, default=datetime.utcnow)
    fis_composite = Column(Float, nullable=True)
    domain_scores_json = Column(Text, default="{}")

    patient = relationship("Patient", back_populates="fis_scores")

    @property
    def domain_scores(self):
        return json.loads(self.domain_scores_json)


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    alert_type = Column(String, nullable=False)
    risk_category = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    acknowledged = Column(Boolean, default=False)

    patient = relationship("Patient", back_populates="alerts")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
