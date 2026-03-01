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
    uses_wearable = Column(Boolean, nullable=True)
    wearable_device_type = Column(String, nullable=True)
    wants_wearable_link = Column(Boolean, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    disease_config_json = Column(Text, nullable=True)  # optional overrides

    entries = relationship("SymptomEntry", back_populates="patient", cascade="all, delete-orphan")
    baseline = relationship("BaselineProfile", back_populates="patient", uselist=False, cascade="all, delete-orphan")
    signals = relationship("ComputedSignal", back_populates="patient", cascade="all, delete-orphan")
    fis_scores = relationship("FunctionalScore", back_populates="patient", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="patient", cascade="all, delete-orphan")
    sensor_streams = relationship("SensorStream", back_populates="patient", cascade="all, delete-orphan")


class SymptomEntry(Base):
    __tablename__ = "symptom_entries"
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    timestamp = Column(DateTime, nullable=False, index=True)
    symptoms_json = Column(Text, nullable=False)   # JSON: {symptom: 0-10}
    triggers_json = Column(Text, nullable=False, default="[]")  # JSON: [trigger_name]
    lifestyle_json = Column(Text, nullable=False, default="{}")  # JSON: structured lifestyle context
    shared_experience_json = Column(Text, nullable=False, default="{}")  # JSON: anonymized structured experience sharing
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

    @property
    def lifestyle_context(self):
        return json.loads(self.lifestyle_json)

    @property
    def shared_experience(self):
        return json.loads(self.shared_experience_json)


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


class SensorStream(Base):
    __tablename__ = "sensor_streams"
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False, index=True)
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)
    source = Column(String, nullable=False, default="simulated_replay")
    sample_count = Column(Integer, default=0)
    duration_minutes = Column(Integer, default=0)
    heart_rate_avg = Column(Float, nullable=True)
    heart_rate_resting = Column(Float, nullable=True)
    heart_rate_max = Column(Float, nullable=True)
    hrv_rmssd = Column(Float, nullable=True)
    spo2_avg = Column(Float, nullable=True)
    skin_temp_avg = Column(Float, nullable=True)
    activity_load = Column(Float, nullable=True)
    recovery_score = Column(Float, nullable=True)
    stress_load = Column(Float, nullable=True)
    signal_quality = Column(String, default="GOOD")
    insights_json = Column(Text, default="[]")
    alerts_json = Column(Text, default="[]")

    patient = relationship("Patient", back_populates="sensor_streams")

    __table_args__ = (
        Index("idx_sensor_stream_patient_time", "patient_id", "recorded_at"),
    )

    @property
    def insights(self):
        return json.loads(self.insights_json)

    @property
    def alerts(self):
        return json.loads(self.alerts_json)


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
    with engine.begin() as conn:
        columns = {
            row[1]
            for row in conn.exec_driver_sql("PRAGMA table_info(patients)").fetchall()
        }
        if "uses_wearable" not in columns:
            conn.exec_driver_sql("ALTER TABLE patients ADD COLUMN uses_wearable BOOLEAN")
        if "wearable_device_type" not in columns:
            conn.exec_driver_sql("ALTER TABLE patients ADD COLUMN wearable_device_type VARCHAR")
        if "wants_wearable_link" not in columns:
            conn.exec_driver_sql("ALTER TABLE patients ADD COLUMN wants_wearable_link BOOLEAN")
        entry_columns = {
            row[1]
            for row in conn.exec_driver_sql("PRAGMA table_info(symptom_entries)").fetchall()
        }
        if "lifestyle_json" not in entry_columns:
            conn.exec_driver_sql("ALTER TABLE symptom_entries ADD COLUMN lifestyle_json TEXT DEFAULT '{}'")
        if "shared_experience_json" not in entry_columns:
            conn.exec_driver_sql("ALTER TABLE symptom_entries ADD COLUMN shared_experience_json TEXT DEFAULT '{}'")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
