import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const uploadCase = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post(`${API_URL}/cases/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getCase = async (caseId) => {
  const response = await axios.get(`${API_URL}/cases/${caseId}`);
  return response.data;
};

export const verifyDirective = async (directiveId, payload) => {
  const response = await axios.put(`${API_URL}/directives/${directiveId}/verify`, payload);
  return response.data;
};

export const getDashboardStats = async () => {
  const response = await axios.get(`${API_URL}/dashboard/stats`);
  return response.data;
};

export const listCases = async () => {
  const response = await axios.get(`${API_URL}/cases`);
  return response.data;
};
