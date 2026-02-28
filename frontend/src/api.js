// src/api.js — Axios API client for RareSignal AI backend
import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: BASE, timeout: 15000 });

export const createPatient = (id, disease) =>
  api.post('/patients', { id, disease });

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

export const getHistory = (patientId) =>
  api.get(`/patients/${patientId}/history`);

export const getBaseline = (patientId) =>
  api.get(`/patients/${patientId}/baseline`);

export const listDiseases = () => api.get('/diseases');

export const getDiseaseConfig = (diseaseId) =>
  api.get(`/diseases/${diseaseId}`);

export default api;
