// src/api.js — Axios API client for RareSignal AI backend
import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: BASE, timeout: 15000 });

export const createPatient = (
  id,
  disease,
  usesWearable = null,
  wearableDeviceType = null,
  wantsWearableLink = null
) =>
  api.post('/patients', {
    id,
    disease,
    uses_wearable: usesWearable,
    wearable_device_type: wearableDeviceType,
    wants_wearable_link: wantsWearableLink
  });

export const getPatient = (id) => api.get(`/patients/${id}`);

export const listPatients = () => api.get('/patients');

export const addEntry = (data) => api.post('/entries', data);

export const getEntries = (patientId, limit = 30) =>
  api.get(`/patients/${patientId}/entries?limit=${limit}`);

export const computeSignals = (patientId, windowDays = 7) =>
  api.post('/compute-signals', { patient_id: patientId, window_days: windowDays });

export const predictRisk = (patientId) =>
  api.post('/predict-risk', { patient_id: patientId });

export const generateSummary = (patientId, windowDays = 7) =>
  api.post('/generate-summary', { patient_id: patientId, window_days: windowDays });

export const generateAiExplainer = (patientId, diseaseName, deviations) =>
  api.post('/generate-ai-explainer', { patient_id: patientId, disease_name: diseaseName, deviations });

export const getHistory = (patientId) =>
  api.get(`/patients/${patientId}/history`);

export const getBaseline = (patientId) =>
  api.get(`/patients/${patientId}/baseline`);

export const getSensorSummary = (patientId) =>
  api.get(`/patients/${patientId}/sensor-summary`);

export const listDiseases = () => api.get('/diseases');

export const getDiseaseConfig = (diseaseId) =>
  api.get(`/diseases/${diseaseId}`);

export const getSharedExperiencesSummary = (diseaseId) =>
  api.get(`/diseases/${diseaseId}/shared-experiences-summary`);

// ── Semantic HPO Matching ──────────────────────────────────────────────────────
export const matchHPO = (symptomText, diseaseId = null, topK = 3) =>
  api.post('/match-hpo', { symptom_text: symptomText, disease_id: diseaseId, top_k: topK });

export const getHpoCluster = (diseaseId) =>
  api.get(`/diseases/${diseaseId}/hpo-cluster`);

// ── Flare / Seizure Prediction Alert ──────────────────────────────────────────
export const getFlareAlert = (patientId) =>
  api.get(`/flare-alert/${patientId}`);

// ── Patient Health Report (Tests + Gemini Summary) ────────────────────────────
export const getHealthReport = (patientId, windowDays = 7) =>
  api.get(`/health-report/${patientId}?window_days=${windowDays}`);

export default api;
