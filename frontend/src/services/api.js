import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ||
  'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000, // 2 min for large PDF uploads
});

// ── Cases ──
export const uploadCase = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/cases/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getCase = async (caseId) => {
  const response = await api.get(`/cases/${caseId}`);
  return response.data;
};

export const listCases = async () => {
  const response = await api.get('/cases');
  return response.data;
};

// ── Directives ──
export const verifyDirective = async (directiveId, payload) => {
  const response = await api.put(`/directives/${directiveId}/verify`, payload);
  return response.data;
};

// ── Dashboard ──
export const getDashboardStats = async () => {
  const response = await api.get('/dashboard/stats');
  return response.data;
};

// ── Pipeline ──
export const uploadPipeline = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/pipeline/process', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getPipelineHealth = async () => {
  const response = await api.get('/pipeline/health');
  return response.data;
};

export default api;
