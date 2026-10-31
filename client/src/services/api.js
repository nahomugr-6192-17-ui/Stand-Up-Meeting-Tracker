const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'include',
    ...options
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  if (response.status === 204) {
    return null;
  }

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const error = new Error(
      (typeof data === 'object' && data?.error) ||
      (typeof data === 'string' && data) ||
      `Request failed with status ${response.status}`
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const authApi = {
  login: (credentials) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),

  logout: () =>
    request('/auth/logout', {
      method: 'POST'
    }),

  getMe: () => request('/auth/me')
};

export const meetingsApi = {
  getMeetings: () => request('/meetings'),

  getMeetingById: (id) => request(`/meetings/${id}`),

  createMeeting: (data) =>
    request('/meetings', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateMeeting: (id, data) =>
    request(`/meetings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  deleteMeeting: (id) =>
    request(`/meetings/${id}`, {
      method: 'DELETE'
    })
};

