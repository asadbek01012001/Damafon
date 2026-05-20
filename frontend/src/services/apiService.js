import axios from 'axios';

const host = window.location.hostname;
const BASE_URL = `http://${host}:5050`;
export const GO2RTC_URL = `http://${host}:1984`;
export const ASTERISK_WS = `ws://${host}:8088/ws`;

const api = axios.create({ baseURL: BASE_URL, timeout: 10000 });

// Door
export const openDoor = () => api.post('/api/door/open');

// Calls
export const getActiveCalls = () => api.get('/api/call/active');
export const hangupCall = (channelId) => api.delete(`/api/call/${channelId}`);

// Devices
export const getDevices = () => api.get('/api/devices');
export const createDevice = (data) => api.post('/api/devices', data);
export const updateDevice = (id, data) => api.put(`/api/devices/${id}`, data);
export const deleteDevice = (id) => api.delete(`/api/devices/${id}`);
export const openDeviceDoor = (id) => api.post(`/api/devices/${id}/open-door`);

export default api;
