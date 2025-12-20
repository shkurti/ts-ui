// API utility for authenticated requests
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  async handleResponse(response) {
    if (!response.ok) {
      if (response.status === 401) {
        // Unauthorized - redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }

  async get(endpoint) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    
    return this.handleResponse(response);
  }

  async post(endpoint, data) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    
    return this.handleResponse(response);
  }

  async put(endpoint, data) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    
    return this.handleResponse(response);
  }

  async delete(endpoint, data = null) {
    const options = {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${this.baseURL}${endpoint}`, options);
    
    return this.handleResponse(response);
  }
}

export const apiService = new ApiService();

// Export specific API methods for easy use
export const trackerApi = {
  getAll: () => apiService.get('/registered_trackers'),
  create: (tracker) => apiService.post('/registered_trackers', tracker),
  delete: (trackerIds) => apiService.delete('/registered_trackers', { tracker_ids: trackerIds }),
  getLocations: () => apiService.get('/tracker_locations'),
};

export const shipmentApi = {
  getAll: () => apiService.get('/shipment_meta'),
  create: (shipment) => apiService.post('/shipment_meta', shipment),
  delete: (shipmentId) => apiService.delete(`/shipment_meta/${shipmentId}`),
  getRouteData: (trackerId, start, end, timezone = 'America/New_York') => 
    apiService.get(`/shipment_route_data?tracker_id=${trackerId}&start=${start}&end=${end}&timezone=${timezone}`),
  getAlerts: (shipmentId, trackerId) => {
    const params = new URLSearchParams();
    if (shipmentId) params.append('shipment_id', shipmentId);
    if (trackerId) params.append('tracker_id', trackerId);
    return apiService.get(`/shipment_alerts?${params}`);
  },
  getAlertEvents: (shipmentId, trackerId) => {
    const params = new URLSearchParams();
    if (shipmentId) params.append('shipment_id', shipmentId);
    if (trackerId) params.append('tracker_id', trackerId);
    return apiService.get(`/shipment_alert_events?${params}`);
  },
};

export const analysisApi = {
  getCarriers: () => apiService.get('/carriers'),
  getAnalytics: (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value);
    });
    const queryString = searchParams.toString();
    return apiService.get(`/analytics${queryString ? `?${queryString}` : ''}`);
  },
  getShipmentLegDuration: () => apiService.get('/analytics/shipment_leg_duration'),
  getShipmentTemperatureData: () => apiService.get('/analytics/shipment_temperature_data'),
  getShipmentHumidityData: () => apiService.get('/analytics/shipment_humidity_data'),
  getCarrierTemperatureData: () => apiService.get('/analytics/carrier_temperature_data'),
  getCarrierHumidityData: () => apiService.get('/analytics/carrier_humidity_data'),
};

export default apiService;