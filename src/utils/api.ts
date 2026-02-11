import AsyncStorage from '@react-native-async-storage/async-storage';

// Production URL (Railway)
const PRODUCTION_API_URL = 'https://web-production-2e659.up.railway.app';

// Use production URL for App Store builds, or env variable for development
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || PRODUCTION_API_URL;

class ApiService {
  private token: string | null = null;

  async getToken(): Promise<string | null> {
    // Always try to get fresh token from storage
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      if (storedToken) {
        this.token = storedToken;
      }
    } catch (error) {
      console.error('Error getting token from storage:', error);
    }
    return this.token;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getToken();
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_URL}${endpoint}`;
    console.log(`API Request: ${options.method || 'GET'} ${url}, Token: ${token ? 'Present' : 'Missing'}`);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log(`API Response: ${response.status} ${response.statusText}`);

    // Handle unauthorized - clear token
    if (response.status === 401) {
      this.token = null;
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('auth_user');
    }

    return response;
  }

  async get(endpoint: string): Promise<Response> {
    return this.fetch(endpoint, { method: 'GET' });
  }

  async post(endpoint: string, data: any): Promise<Response> {
    return this.fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(endpoint: string, data: any): Promise<Response> {
    return this.fetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint: string): Promise<Response> {
    return this.fetch(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiService();
export default api;
